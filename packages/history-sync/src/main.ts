import { createLogger, httpRpc, logError, nats, registry } from '@agentg/framework';

import { readConfig } from './config.js';
import { historySyncModule } from './module.js';

const logger = createLogger('history-sync');
const config = readConfig(process.env);
const app = historySyncModule({
  config,
  connect: {
    events: nats(config.natsUrl),
    rpc: httpRpc(
      config.host === undefined ? { port: config.port } : { host: config.host, port: config.port }
    ),
    registry: registry(config.registryUrl)
  }
});

try {
  await app.start();
} catch (error) {
  logger.error(
    {
      event: 'history-sync.failed',
      ...logError(error)
    },
    'history sync failed'
  );
  process.exitCode = 1;
}
