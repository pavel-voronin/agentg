import { defineModule } from '@agentg/framework';

import { triggerRulePolicy } from '../policies/policies.js';
import { readConfig } from './config.js';
import { createDatabase } from './database/client.js';
import { createRpcDispatcher } from './dispatcher/dispatcher.js';
import { createTriggerEventPublisher } from './events.js';
import { createTriggerRuntime, startTriggerRuntimeLoop } from './runtime.js';
import { listOccurrencesInputSchema } from './schema.js';
import { createPostgresTriggerStore } from './store.js';

export const moduleDefinition = defineModule('triggers', {
  config: readConfig,
  setup({ config, events, resource, usePolicy }) {
    const getRules = usePolicy(triggerRulePolicy);
    const database = resource('database', ({ startup }) => {
      const resource = createDatabase(config.databaseUrl);

      startup(() => resource.start());

      return resource.db;
    });
    const runtime = resource('runtime', ({ background, startup }) => {
      const value = createTriggerRuntime({
        dispatcher: createRpcDispatcher({
          targets: config.actionTargets,
          timeoutMs: config.dispatchTimeoutMs
        }),
        events: createTriggerEventPublisher(events),
        getRules,
        leaseOwner: `triggers:${String(process.pid)}`,
        leaseSeconds: config.leaseSeconds,
        lookbackSeconds: config.lookbackSeconds,
        maxDispatchAttempts: config.maxDispatchAttempts,
        store: createPostgresTriggerStore(database)
      });

      startup(async () => {
        await value.reconcile();
        return undefined;
      });
      background('scheduler', () => {
        return startTriggerRuntimeLoop({
          intervalMs: config.schedulerIntervalMs,
          runtime: value
        });
      });

      return value;
    });

    return {
      listOccurrences: (input: unknown) =>
        runtime.listOccurrences(listOccurrencesInputSchema.parse(input)),
      listTriggerRegistrations: () => runtime.listTriggerRegistrations(),
      runDueTriggers: () => runtime.runDueTriggers()
    };
  }
});
