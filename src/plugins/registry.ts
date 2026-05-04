import type { PluginContext, TrustedPlugin } from './types.js';

export type PluginRegistry = {
  list(): readonly TrustedPlugin[];
  start(context: PluginContext): Promise<void>;
  stop(): Promise<void>;
};

export function createPluginRegistry(plugins: readonly TrustedPlugin[]): PluginRegistry {
  const started: TrustedPlugin[] = [];

  return {
    list(): readonly TrustedPlugin[] {
      return plugins;
    },
    async start(context): Promise<void> {
      for (const plugin of plugins) {
        await plugin.start(context);
        started.push(plugin);
      }
    },
    async stop(): Promise<void> {
      const errors: unknown[] = [];

      for (const plugin of started.splice(0).reverse()) {
        try {
          await plugin.stop();
        } catch (error) {
          errors.push(error);
        }
      }

      if (errors.length > 0) {
        throw new AggregateError(errors, 'Plugins failed to stop');
      }
    }
  };
}
