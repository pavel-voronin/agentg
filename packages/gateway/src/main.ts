import { httpRpc, nats, registry } from '@agentg/framework';

import { readConfig } from './config.js';
import { gatewayModule } from './module.js';

const config = readConfig(process.env);
const app = gatewayModule({
  config,
  connect: {
    events: nats(config.natsUrl),
    rpc: httpRpc(
      config.rpcHost === undefined
        ? { port: config.rpcPort }
        : { host: config.rpcHost, port: config.rpcPort }
    ),
    registry: registry(config.registryUrl)
  }
});

try {
  await app.start();
  console.log('gateway started');
} catch (error) {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'gateway.failed'
    })
  );
  process.exitCode = 1;
}
