import { defineModule } from '@agentg/framework';

import { readConfig } from './config.js';
import { startGatewayServer } from './server.js';

type ChatLookup = {
  getChat(input: { chatId: string }): Promise<unknown>;
};

export const gatewayModule = defineModule('gateway', {
  config: readConfig,
  setup({ background, config, events, rpc }) {
    const chatLookup = rpc<ChatLookup>('telegram');

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

    return {
      required: true
    };
  }
});
