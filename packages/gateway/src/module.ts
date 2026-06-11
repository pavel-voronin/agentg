import { defineModule } from '@agentg/framework';
import { telegramClient } from '@agentg/telegram';

import { readConfig } from './config.js';
import { startGatewayServer } from './server.js';

export const gatewayModule = defineModule('gateway', {
  config: readConfig,
  setup({ background, config, events }) {
    const chatLookup = telegramClient({ url: config.telegramRpcUrl });

    background('server', () =>
      startGatewayServer({
        chatLookup,
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
