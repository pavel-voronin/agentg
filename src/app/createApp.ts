import { createEventBus, type EventBus } from '../bus/eventBus.js';
import { createAppEvent } from '../bus/events.js';
import {
  createTelegramRepository,
  type TelegramRepository
} from '../telegram/telegramRepository.js';
import {
  createTelegramService,
  type TelegramService
} from '../telegram/telegramService.js';
import { openSqliteDatabase, type SqliteDatabase } from '../storage/sqlite.js';
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
  sqlite: SqliteDatabase;
};

export type AppRepositoryRegistry = {
  telegram: TelegramRepository;
};

export type AppServiceRegistry = {
  telegram: TelegramService;
};

export type AppPluginRegistry = Record<string, unknown>;

export type AppEdgeRegistry = Record<string, unknown>;

export function createApp(input: CreateAppInput = {}): AppRuntime {
  const config = loadAppConfig(input);
  const sqlite = openSqliteDatabase(config.database);
  const eventBus = createEventBus();
  const telegramRepository = createTelegramRepository(sqlite.connection);
  const telegramService = createTelegramService({
    eventBus,
    repository: telegramRepository
  });
  const storage: AppStorageHandle = {
    sqlite
  };
  const lifecycle = createLifecycle([
    {
      name: 'sqlite',
      stop(): void {
        sqlite.close();
      }
    },
    ...(input.lifecycleResources ?? [])
  ]);
  let stopped = false;

  return {
    config,
    edges: {},
    eventBus,
    lifecycle,
    plugins: {},
    repositories: {
      telegram: telegramRepository
    },
    services: {
      telegram: telegramService
    },
    storage,
    async start(): Promise<void> {
      await lifecycle.start();
      await eventBus.publish(
        createAppEvent({
          data: {
            databasePath: storage.sqlite.path
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
