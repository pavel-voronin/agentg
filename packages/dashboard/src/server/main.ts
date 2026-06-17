import { createLogger, logError, nats } from '@agentg/framework';

import { readConfig } from './config.js';
import { serverModule } from './module.js';

const logger = createLogger('dashboard');
const config = readConfig(process.env);
const app = serverModule({
  config,
  connect: {
    events: nats(config.natsUrl)
  }
});

try {
  await app.start();
} catch (error) {
  logger.error(
    {
      event: 'dashboard.failed',
      ...logError(error)
    },
    'dashboard failed'
  );
  process.exitCode = 1;
}
