import { defineModule } from '@agentg/framework';
import { createPolicyClient } from '@agentg/framework/policies';
import { telegramClient } from '@agentg/telegram';

import { readConfig } from './config.js';
import { startGatewayServer } from './server.js';

export const gatewayModule = defineModule('gateway', {
  config: readConfig,
  setup({ background, config, events }) {
    const policies = createPolicyClient({ url: config.policiesRpcUrl });
    const telegram = telegramClient({ url: config.telegramRpcUrl });

    background('server', () =>
      startGatewayServer({
        access: {
          policies,
          telegram
        },
        config: {
          host: config.host,
          port: config.port,
          ...(config.token === undefined ? {} : { token: config.token })
        },
        events
      })
    );

    return {};
  }
});
