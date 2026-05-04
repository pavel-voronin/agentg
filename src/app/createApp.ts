import { createEventBus, type EventBus } from '../bus/eventBus.js';
import { createAppEvent } from '../bus/events.js';
import { loadAppConfig, type AppConfig, type LoadAppConfigInput } from './config.js';
import { createLifecycle, type AppLifecycle, type LifecycleResource } from './lifecycle.js';

export type AppRuntime = {
  config: AppConfig;
  edges: AppEdgeRegistry;
  eventBus: EventBus;
  lifecycle: AppLifecycle;
  plugins: AppPluginRegistry;
  repositories: AppRepositoryRegistry;
  services: AppServiceRegistry;
  start(): Promise<void>;
  stop(): Promise<void>;
  storage: AppStorageHandle;
};

export type CreateAppInput = LoadAppConfigInput & {
  lifecycleResources?: LifecycleResource[];
};

export type AppStorageHandle = {
  databasePath: string;
  kind: 'sqlite';
};

export type AppRepositoryRegistry = Record<string, unknown>;

export type AppServiceRegistry = Record<string, unknown>;

export type AppPluginRegistry = Record<string, unknown>;

export type AppEdgeRegistry = Record<string, unknown>;

export function createApp(input: CreateAppInput = {}): AppRuntime {
  const config = loadAppConfig(input);
  const eventBus = createEventBus();
  const lifecycle = createLifecycle(input.lifecycleResources ?? []);
  const storage: AppStorageHandle = {
    databasePath: config.database.path,
    kind: 'sqlite'
  };
  let stopped = false;

  return {
    config,
    edges: {},
    eventBus,
    lifecycle,
    plugins: {},
    repositories: {},
    services: {},
    storage,
    async start(): Promise<void> {
      await lifecycle.start();
      await eventBus.publish(
        createAppEvent({
          data: {
            databasePath: storage.databasePath
          },
          source: 'app',
          type: 'app.started'
        })
      );
    },
    async stop(): Promise<void> {
      if (stopped) {
        return;
      }

      stopped = true;
      await eventBus.publish(
        createAppEvent({
          data: {},
          source: 'app',
          type: 'app.stopping'
        })
      );
      await lifecycle.stop();
      await eventBus.publish(
        createAppEvent({
          data: {},
          source: 'app',
          type: 'app.stopped'
        })
      );
      eventBus.close();
    }
  };
}
