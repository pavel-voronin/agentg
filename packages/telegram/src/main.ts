import { httpRpc, nats, registry } from '@agentg/framework';

import { readConfig } from './config.js';
import { telegramModule } from './module.js';

const config = readConfig(process.env);
const app = telegramModule({
  config,
  connect: {
    events: nats(config.natsUrl),
    rpc: httpRpc(
      config.host === undefined ? { port: config.port } : { host: config.host, port: config.port }
    ),
    registry: registry(config.registryUrl)
  }
});

await app.start();

console.log('telegram started');
