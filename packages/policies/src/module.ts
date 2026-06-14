import { defineModule } from '@agentg/framework';
import { createPolicyServer } from '@agentg/framework/policies';

import { readConfig } from './config.js';
import { policyCatalog } from './generated/policyCatalog.js';
import { createFileStore } from './store.js';

export const endpointModule = defineModule('policies', {
  config: readConfig,
  setup({ config, events, resource }) {
    const procedures = resource('server', ({ startup }) => {
      const server = createPolicyServer({
        catalog: policyCatalog,
        events,
        store: createFileStore({
          directory: config.configDirectory
        })
      });

      startup(async () => {
        await server.start();
        return undefined;
      });

      return server.procedures;
    });

    return procedures;
  }
});
