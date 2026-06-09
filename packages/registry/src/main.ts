import {
  createLogger,
  httpRpc,
  logError,
  nats,
  selfRegistry,
  registryModule
} from '@agentg/framework';

import { readConfig } from './config.js';

const logger = createLogger('registry');
const config = readConfig(process.env);
const app = registryModule({
  config: {},
  connect: {
    events: nats(config.natsUrl),
    rpc: httpRpc(
      config.host === undefined ? { port: config.port } : { host: config.host, port: config.port }
    ),
    registry: selfRegistry()
  }
});

try {
  await app.start();
} catch (error) {
  logger.error(
    {
      event: 'registry.failed',
      ...logError(error)
    },
    'registry failed'
  );
  process.exitCode = 1;
}

globalThis.process.once('SIGINT', () => {
  void app.stop();
});
globalThis.process.once('SIGTERM', () => {
  void app.stop();
});
