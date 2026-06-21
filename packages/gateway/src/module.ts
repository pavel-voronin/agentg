import { defineModule } from '@agentg/framework';
import { createPolicyClient } from '@agentg/framework/policies';
import { dataClient } from '@agentg/data';
import { pipelinesClient } from '@agentg/pipelines';
import { telegramClient } from '@agentg/telegram';

import { readConfig } from './config.js';
import { startGatewayServer } from './server.js';

export const gatewayModule = defineModule('gateway', {
  config: readConfig,
  setup({ background, config, events }) {
    const data = dataClient({ url: config.dataRpcUrl });
    const pipelines = pipelinesClient({ url: config.pipelinesRpcUrl });
    const policies = createPolicyClient({ url: config.policiesRpcUrl });
    const telegram = telegramClient({ url: config.telegramRpcUrl });

    background('server', () =>
      startGatewayServer({
        access: {
          data,
          pipelines,
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
