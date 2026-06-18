import { createLogger, httpRpc, logError, nats } from '@agentg/framework';
import { createPolicyClient } from '@agentg/framework/policies';

import { readConfig } from './config.js';
import { moduleDefinition } from './module.js';

const logger = createLogger('triggers');
const config = readConfig(process.env);
const app = moduleDefinition({
  config,
  connect: {
    events: nats(config.natsUrl),
    policies: () => createPolicyClient({ url: config.policiesRpcUrl }),
    rpc: httpRpc(
      config.host === undefined
        ? { port: config.port, service: 'triggers' }
        : { host: config.host, port: config.port, service: 'triggers' }
    )
  }
});

try {
  await app.start();
} catch (error) {
  logger.error(
    {
      event: 'triggers.failed',
      ...logError(error)
    },
    'triggers failed'
  );
  process.exitCode = 1;
}
