import { createRegistryClient, type RegistryClientConfig } from './client.js';
import type { RegistryConnector } from './connector.js';

export function registry(config: RegistryClientConfig | string): RegistryConnector {
  const clientConfig = typeof config === 'string' ? { url: config } : config;
  return {
    async connect(options) {
      const client = createRegistryClient(clientConfig);
      await client.join(options.manifest);
      return {
        close() {
          client.close();
        },
        getSnapshot() {
          return client.getSnapshot();
        },
        refresh() {
          return client.refresh();
        }
      };
    }
  };
}
