import { defineModule } from '@agentg/framework';

import { readConfig } from './config.js';
import { createDatabase } from './database/client.js';
import { createEventPublisher } from './events.js';
import { createConfiguredProfileRunner } from './profiles/openaiCompatible.js';
import { createRuntime, startRunRecoveryLoop } from './runtime.js';
import {
  getRunResultInputSchema,
  runActionRequestSchema,
  runActionResultSchema,
  runResultSchema
} from './schema.js';
import { createPostgresStore } from './store.js';

export const moduleDefinition = defineModule('llm-runner', {
  config: readConfig,
  setup({ config, events, resource }) {
    const database = resource('database', ({ startup }) => {
      const resource = createDatabase(config.databaseUrl);

      startup(() => resource.start());

      return resource.db;
    });
    const runtime = resource('runtime', ({ background }) => {
      const value = createRuntime({
        events: createEventPublisher(events),
        profiles: createConfiguredProfileRunner({
          profiles: config.profiles
        }),
        store: createPostgresStore(database)
      });

      background('worker', () =>
        startRunRecoveryLoop({
          intervalMs: config.workerIntervalMs,
          runtime: value
        })
      );

      return value;
    });

    return {
      'llm.run': async (input: unknown) =>
        runActionResultSchema.parse(await runtime.run(runActionRequestSchema.parse(input))),
      getRunResult: async (input: unknown) => {
        const result = await runtime.getRunResult(getRunResultInputSchema.parse(input));
        return result === null ? null : runResultSchema.parse(result);
      }
    };
  }
});
