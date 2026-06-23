import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLogger, defineModule, logError } from '@agentg/framework';

import { pipelineAutomationRulesPolicy } from '../policies/policies.js';
import { createRpcDispatcher, createRpcResultReader } from './actions.js';
import { readConfig } from './config.js';
import { createDatabase } from './database/client.js';
import { createRuntime } from './runtime.js';
import { createPostgresStore } from './store.js';
import { createRegistrationClient } from './triggers.js';

const logger = createLogger('pipelines');
const specPath =
  process.env.PIPELINE_SPEC_PATH === undefined
    ? fileURLToPath(new URL('../../../docs/03-domains/pipelineSpec.md', import.meta.url))
    : resolve(process.env.PIPELINE_SPEC_PATH);

export const moduleDefinition = defineModule('pipelines', {
  config: readConfig,
  setup({ config, events, resource, startup, usePolicy }) {
    const database = resource('database', ({ startup }) => {
      const resource = createDatabase(config.databaseUrl);

      startup(() => resource.start());

      return resource.db;
    });
    const runtime = resource('runtime', () =>
      createRuntime({
        dispatcher: createRpcDispatcher({
          targets: config.actionTargets,
          timeoutMs: config.actionTimeoutMs
        }),
        registration: createRegistrationClient({
          timeoutMs: config.actionTimeoutMs,
          url: config.triggersRpcUrl
        }),
        results: createRpcResultReader({
          targets: config.actionTargets,
          timeoutMs: config.actionTimeoutMs
        }),
        store: createPostgresStore(database)
      })
    );
    usePolicy(pipelineAutomationRulesPolicy, {
      onChange: (rules) => runtime.reconcilePolicyRules(rules)
    });

    startup('providerResultEvents', () => {
      const completed = events.subscribe('llmRunner.run.completed', (event) =>
        runtime.resumeProviderRun(event.data)
      );
      const failed = events.subscribe('llmRunner.run.failed', (event) =>
        runtime.resumeProviderRun(event.data)
      );
      void runtime.resumeWaitingRuns().catch((error: unknown) => {
        logger.error(
          {
            event: 'pipelines.resume_waiting_failed',
            ...logError(error)
          },
          'pipelines waiting resume failed'
        );
      });
      return () => {
        completed.unsubscribe();
        failed.unsubscribe();
        return undefined;
      };
    });

    return {
      deletePipeline: (input: unknown) => runtime.deletePipeline(input),
      describeSpec: () => readSpec(),
      getPipeline: (input: unknown) => runtime.getPipeline(input),
      getRun: (input: unknown) => runtime.getRun(input),
      listPipelines: () => runtime.listPipelines(),
      listRuns: (input: unknown) => runtime.listRuns(input),
      runPipeline: (input: unknown) => runtime.runPipeline(input),
      runTriggered: (input: unknown) => runtime.runTriggered(input),
      setPipeline: (input: unknown) => runtime.setPipeline(input)
    };
  }
});

async function readSpec() {
  return {
    format: 'markdown',
    path: specPath,
    text: await readFile(specPath, 'utf8')
  };
}
