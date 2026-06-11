import { createLogger, httpRpc, logError, nats } from '@agentg/framework';

import { readConfig } from './config.js';
import { gatewayModule } from './module.js';

const logger = createLogger('gateway');
const config = readConfig(process.env);
const app = gatewayModule({
  config,
  connect: {
    events: nats(config.natsUrl),
    rpc: httpRpc(
      config.rpcHost === undefined
        ? { port: config.rpcPort, service: 'gateway' }
        : { host: config.rpcHost, port: config.rpcPort, service: 'gateway' }
    )
  }
});

try {
  await app.start();
} catch (error) {
  logger.error(
    {
      event: 'gateway.failed',
      ...logError(error)
    },
    'gateway failed'
  );
  process.exitCode = 1;
}
