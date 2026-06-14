import { createLogger, httpRpc, logError, nats } from '@agentg/framework';

import { readConfig } from './config.js';
import { endpointModule } from './module.js';

const logger = createLogger('policies');
const config = readConfig(process.env);
const app = endpointModule({
  config,
  connect: {
    events: nats(config.natsUrl),
    rpc: httpRpc(
      config.host === undefined
        ? { port: config.port, service: 'policies' }
        : { host: config.host, port: config.port, service: 'policies' }
    )
  }
});

try {
  await app.start();
} catch (error) {
  logger.error(
    {
      event: 'policies.failed',
      ...logError(error)
    },
    'policies failed'
  );
  process.exitCode = 1;
}
