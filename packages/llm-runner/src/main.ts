import { createLogger, httpRpc, logError, nats } from '@agentg/framework';

import { readConfig } from './config.js';
import { moduleDefinition } from './module.js';

const logger = createLogger('llm-runner');
const config = readConfig(process.env);
const app = moduleDefinition({
  config,
  connect: {
    events: nats(config.natsUrl),
    rpc: httpRpc(
      config.host === undefined
        ? { port: config.port, service: 'llm-runner' }
        : { host: config.host, port: config.port, service: 'llm-runner' }
    )
  }
});

try {
  await app.start();
} catch (error) {
  logger.error(
    {
      event: 'llm_runner.failed',
      ...logError(error)
    },
    'llm runner failed'
  );
  process.exitCode = 1;
}
