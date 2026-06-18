import { defineModule } from '@agentg/framework';

import { readConfig } from './config.js';
import { createDatabase } from './database/client.js';
import { createEventPublisher } from './events.js';
import { createConfiguredProfileRunner } from './profiles/openaiCompatible.js';
import {
  getCurrentArtifactInputSchema,
  listArtifactsInputSchema,
  llmRunPayloadSchema,
  runOutputSchema,
  runTriggeredInputSchema
} from './schema.js';
import { createRpcSourceResolver } from './sources/rpcResolver.js';
import { createRuntime, startRuntimeLoop } from './runtime.js';
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
        sources: createRpcSourceResolver({
          resolvers: config.sourceResolvers
        }),
        store: createPostgresStore(database)
      });

      background('worker', () => {
        return startRuntimeLoop({
          intervalMs: config.workerIntervalMs,
          runtime: value
        });
      });

      return value;
    });

    return {
      getCurrentArtifact: async (input: unknown) => {
        return runtime.getCurrentArtifact(getCurrentArtifactInputSchema.parse(input));
      },
      listArtifacts: (input: unknown) =>
        runtime.listArtifacts(listArtifactsInputSchema.parse(input)),
      run: async (input: unknown) =>
        runOutputSchema.parse(await runtime.run(llmRunPayloadSchema.parse(input))),
      runTriggered: async (input: unknown) => {
        const parsed = runTriggeredInputSchema.parse(input);
        return runOutputSchema.parse(
          await runtime.runTriggered({
            payload: parsed.actionInput,
            provenance: {
              occurrence: parsed.occurrence,
              trigger: parsed.trigger
            }
          })
        );
      }
    };
  }
});
