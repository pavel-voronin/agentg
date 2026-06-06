import { httpRpc, nats, registry } from '@agentg/framework';

import { collectorModule } from './module.js';
import { readConfig } from './config.js';

const config = readConfig(process.env);
const app = collectorModule({
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
  console.log('telemetry started');
} catch (error) {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'telemetry.failed'
    })
  );
  process.exitCode = 1;
}
