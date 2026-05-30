import { defineConfig, number, type ConfigOf } from '../config.js';
import type { EventBus } from '../events/eventBus.js';
import { defineModule } from '../module.js';

import { CHANGED_EVENT, DEFAULT_REGISTRY_LEASE_TTL_MS } from './contracts.js';
import { createRegistry } from './registry.js';

const readRegistryConfig = defineConfig({
  ttlMs: number('REGISTRY_LEASE_TTL_MS').optional()
});

export type RegistryConfig = ConfigOf<typeof readRegistryConfig>;

export const registryModule = defineModule('registry', {
  config: readRegistryConfig,
  setup({ config, events, resource }) {
    const registry = resource('registry', ({ background }) => {
      const registry = createRegistry(config.ttlMs === undefined ? {} : { ttlMs: config.ttlMs });

      background('leaseSweep', () => {
        const sweep = setInterval(() => {
          publishChanged(registry, events, () => registry.getSnapshot());
        }, sweepIntervalMs(config.ttlMs));
        sweep.unref();

        return () => {
          clearInterval(sweep);
          return undefined;
        };
      });

      return registry;
    });
    const procedures = {
      getSnapshot: () => publishChanged(registry, events, () => registry.getSnapshot()),
      join: (input: Parameters<typeof registry.join>[0]) =>
        publishChanged(registry, events, () => registry.join(input)),
      renew: (input: Parameters<typeof registry.renew>[0]) =>
        publishChanged(registry, events, () => registry.renew(input))
    };

    return {
      procedures
    };
  }
});

function publishChanged<T>(registry: { version(): number }, events: EventBus, run: () => T): T {
  const before = registry.version();
  const output = run();
  const after = registry.version();
  if (after !== before) {
    events.publish(CHANGED_EVENT, {
      version: after
    });
  }
  return output;
}

function sweepIntervalMs(ttlMs: number | undefined): number {
  return Math.max(10, Math.floor((ttlMs ?? DEFAULT_REGISTRY_LEASE_TTL_MS) / 2));
}
