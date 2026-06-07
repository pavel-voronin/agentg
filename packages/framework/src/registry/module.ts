import { defineConfig, type ConfigOf } from '../config.js';
import { defineModule } from '../module.js';

import { createRegistry } from './registry.js';

const readRegistryConfig = defineConfig({});

export type RegistryConfig = ConfigOf<typeof readRegistryConfig>;

export const registryModule = defineModule('registry', {
  config: readRegistryConfig,
  setup({ resource }) {
    const registry = resource('registry', () => createRegistry());
    const procedures = {
      getSnapshot: () => registry.getSnapshot(),
      join: (input: Parameters<typeof registry.join>[0]) => registry.join(input)
    };

    return {
      procedures
    };
  }
});
