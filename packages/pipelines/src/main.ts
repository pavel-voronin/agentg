import { createLogger, httpRpc, logError, nats } from '@agentg/framework';

import { readConfig } from './config.js';
import { moduleDefinition } from './module.js';

const logger = createLogger('pipelines');
const config = readConfig(process.env);
const app = moduleDefinition({
  config,
  connect: {
    events: nats(config.natsUrl),
    rpc: httpRpc(
      config.host === undefined
        ? { port: config.port, service: 'pipelines' }
        : { host: config.host, port: config.port, service: 'pipelines' }
    )
  }
});

try {
  await app.start();
} catch (error) {
  logger.error(
    {
      event: 'pipelines.failed',
      ...logError(error)
    },
    'pipelines failed'
  );
  process.exitCode = 1;
}
