import { httpRpc, nats, selfRegistry, registryModule } from '@agentg/framework';

import { readConfig } from './config.js';

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

await app.start();

console.log('registry started');

globalThis.process.once('SIGINT', () => {
  void app.stop();
});
globalThis.process.once('SIGTERM', () => {
  void app.stop();
});
