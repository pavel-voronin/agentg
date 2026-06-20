import { createLogger, httpRpc, logError, nats } from '@agentg/framework';

import { readConfig } from './config.js';
import { moduleDefinition } from './module.js';

const logger = createLogger('data');
const config = readConfig(process.env);
const app = moduleDefinition({
  config,
  connect: {
    events: nats(config.natsUrl),
    rpc: httpRpc(
      config.host === undefined
        ? { port: config.port, service: 'data' }
        : { host: config.host, port: config.port, service: 'data' }
    )
  }
});

try {
  await app.start();
} catch (error) {
  logger.error(
    {
      event: 'data.failed',
      ...logError(error)
    },
    'data failed'
  );
  process.exitCode = 1;
}
