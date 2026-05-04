import { createEventBus, type EventBus } from '../bus/eventBus.js';
import { createAppEvent } from '../bus/events.js';
import {
  createTelegramRepository,
  type TelegramRepository
} from '../telegram/telegramRepository.js';
import { createTelegramService, type TelegramService } from '../telegram/telegramService.js';
import { createHistoryRepository, type HistoryRepository } from '../history/historyRepository.js';
import { createHistoryService, type HistoryService } from '../history/historyService.js';
import { createPluginRegistry, type PluginRegistry } from '../plugins/registry.js';
import { createSummariesPlugin, type SummariesPlugin } from '../plugins/summaries/plugin.js';
import {
  createSummariesRepository,
  type SummariesRepository
} from '../plugins/summaries/repository.js';
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
  history: HistoryRepository;
  summaries: SummariesRepository;
  telegram: TelegramRepository;
};

export type AppServiceRegistry = {
  history: HistoryService;
  telegram: TelegramService;
};

export type AppPluginRegistry = {
  registry: PluginRegistry;
  summaries: SummariesPlugin;
};

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
  const historyRepository = createHistoryRepository(sqlite.connection);
  const historyService = createHistoryService({
    eventBus,
    repository: historyRepository,
    telegramService
  });
  const summariesRepository = createSummariesRepository(sqlite.connection);
  const summariesPlugin = createSummariesPlugin({
    repository: summariesRepository
  });
  const pluginRegistry = createPluginRegistry([summariesPlugin]);
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
    {
      name: 'history',
      start(): void {
        historyService.start();
      },
      stop(): void {
        historyService.stop();
      }
    },
    {
      name: 'plugins',
      async start(): Promise<void> {
        await pluginRegistry.start({
          eventBus,
          historyService,
          telegramService
        });
      },
      async stop(): Promise<void> {
        await pluginRegistry.stop();
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
    plugins: {
      registry: pluginRegistry,
      summaries: summariesPlugin
    },
    repositories: {
      history: historyRepository,
      summaries: summariesRepository,
      telegram: telegramRepository
    },
    services: {
      history: historyService,
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
