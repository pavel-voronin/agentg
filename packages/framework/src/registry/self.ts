import type { RegistryConnector } from './connector.js';

export function selfRegistry(): RegistryConnector {
  return {
    connect() {
      return Promise.resolve({
        close() {
          return;
        },
        getSnapshot() {
          throw new Error('Registry snapshot is not available from the self registry connector');
        },
        refresh() {
          throw new Error('Registry snapshot is not available from the self registry connector');
        }
      });
    }
  };
}
