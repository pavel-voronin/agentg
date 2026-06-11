import { createLogger, httpRpc, logError, nats } from '@agentg/framework';

import { readConfig } from './config.js';
import { telegramModule } from './module.js';

const logger = createLogger('telegram');
const config = readConfig(process.env);
const app = telegramModule({
  config,
  connect: {
    events: nats(config.natsUrl),
    rpc: httpRpc(
      config.host === undefined
        ? { port: config.port, service: 'telegram' }
        : { host: config.host, port: config.port, service: 'telegram' }
    )
  }
});

try {
  await app.start();
} catch (error) {
  logger.error(
    {
      event: 'telegram.failed',
      ...logError(error)
    },
    'telegram failed'
  );
  process.exitCode = 1;
}
