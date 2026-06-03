import { httpRpc, nats, registry } from '@agentg/framework';

import { readConfig } from './config.js';
import { historySyncModule } from './module.js';

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

await app.start();

console.log('history-sync started');
