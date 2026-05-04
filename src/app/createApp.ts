import { createEventBus, type EventBus } from '../bus/eventBus.js';
import { createAppEvent } from '../bus/events.js';
import {
  startControlPlaneServer,
  type ControlPlaneServerHandle
} from '../edges/control-plane/server.js';
import { startGatewayServer, type GatewayServerHandle } from '../edges/gateway/server.js';
import {
  createTelegramRepository,
  type TelegramRepository
} from '../telegram/telegramRepository.js';
import { createTelegramService, type TelegramService } from '../telegram/telegramService.js';
import {
  createTelegramTdlibClient,
  hasTelegramCredentials,
  type TdlibSubscription,
  type TelegramTdlibClient
} from '../telegram/tdlibClient.js';
import { createHistoryRepository, type HistoryRepository } from '../history/historyRepository.js';
import { createHistoryService, type HistoryService } from '../history/historyService.js';
import { createPluginRegistry, type PluginRegistry } from '../plugins/registry.js';
import type { TrustedPlugin } from '../plugins/types.js';
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

export type AppEdgeRegistry = {
  controlPlane?: ControlPlaneServerHandle;
  gateway?: GatewayServerHandle;
};

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
  const pluginRegistry = createPluginRegistry(
    selectEnabledPlugins(config.plugins.enabled, {
      summaries: summariesPlugin
    })
  );
  const edges: AppEdgeRegistry = {};
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
      async stop(): Promise<void> {
        await historyService.stop();
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
    {
      name: 'edges',
      async start(): Promise<void> {
        const plugins: AppPluginRegistry = {
          registry: pluginRegistry,
          summaries: summariesPlugin
        };
        const services: AppServiceRegistry = {
          history: historyService,
          telegram: telegramService
        };

        if (config.controlPlane.enabled) {
          edges.controlPlane = await startControlPlaneServer({
            config: config.controlPlane,
            eventBus,
            plugins,
            services
          });
        }

        if (config.gateway.enabled) {
          edges.gateway = await startGatewayServer({
            capabilities: config.gatewayCapabilities.enabled,
            config: config.gateway,
            eventBus,
            plugins,
            services
          });
        }
      },
      async stop(): Promise<void> {
        await edges.gateway?.close();
        delete edges.gateway;
        await edges.controlPlane?.close();
        delete edges.controlPlane;
      }
    },
    createTelegramTdlibLifecycleResource(config, eventBus, telegramService),
    ...(input.lifecycleResources ?? [])
  ]);
  let stopped = false;

  return {
    config,
    edges,
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

function selectEnabledPlugins(
  configuredPluginNames: readonly string[],
  plugins: {
    summaries: SummariesPlugin;
  }
): TrustedPlugin[] {
  const enabledPluginNames =
    configuredPluginNames.length === 0 ? ['summaries'] : [...configuredPluginNames];

  return enabledPluginNames.map((pluginName) => {
    switch (pluginName) {
      case 'summaries':
        return plugins.summaries;
      default:
        throw new Error(`Unknown plugin: ${pluginName}`);
    }
  });
}

function createTelegramTdlibLifecycleResource(
  config: AppConfig,
  eventBus: EventBus,
  telegramService: TelegramService
): LifecycleResource {
  let client: TelegramTdlibClient | undefined;
  let subscriptions: TdlibSubscription[] = [];

  return {
    name: 'telegram.tdlib',
    async start(): Promise<void> {
      if (!hasTelegramCredentials(config.tdlib)) {
        await publishTelegramTdlibStatus(eventBus, {
          authenticated: false,
          configured: false,
          connected: false
        });
        return;
      }

      const tdlibClient = await createTelegramTdlibClient(config.tdlib);
      client = tdlibClient;
      telegramService.setTdlibClient(tdlibClient);
      subscriptions = [
        tdlibClient.onError((error) => {
          void publishTelegramTdlibError(eventBus, error);
        }),
        tdlibClient.onUpdate((update) => {
          void handleTelegramTdlibUpdate(eventBus, telegramService, update);
        })
      ];

      await publishTelegramTdlibStatus(eventBus, {
        authenticated: false,
        configured: true,
        connected: false
      });
      await tdlibClient.login();
      await publishTelegramTdlibStatus(eventBus, {
        authenticated: true,
        configured: true,
        connected: true
      });
    },
    async stop(): Promise<void> {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
      subscriptions = [];

      const tdlibClient = client;
      if (tdlibClient === undefined) {
        return;
      }

      telegramService.clearTdlibClient(tdlibClient);
      client = undefined;
      await publishTelegramTdlibStatus(eventBus, {
        authenticated: false,
        configured: true,
        connected: false
      });
      await tdlibClient.close();
    }
  };
}

async function handleTelegramTdlibUpdate(
  eventBus: EventBus,
  telegramService: TelegramService,
  update: unknown
): Promise<void> {
  const connectionState = readTdlibConnectionState(update);
  if (connectionState !== undefined) {
    await publishTelegramTdlibStatus(eventBus, {
      authenticated: connectionState === 'connectionStateReady',
      configured: true,
      connected: connectionState === 'connectionStateReady'
    });
  }

  await telegramService.ingestUpdate(update);
}

async function publishTelegramTdlibStatus(
  eventBus: EventBus,
  data: {
    authenticated: boolean;
    configured: boolean;
    connected: boolean;
  }
): Promise<void> {
  await eventBus.publish(
    createAppEvent({
      data,
      source: 'telegram.tdlib',
      type: 'telegram.tdlib.status'
    })
  );
}

async function publishTelegramTdlibError(eventBus: EventBus, error: Error): Promise<void> {
  await eventBus.publish(
    createAppEvent({
      data: {
        message: error.message
      },
      source: 'telegram.tdlib',
      type: 'telegram.tdlib.error'
    })
  );
}

function readTdlibConnectionState(update: unknown): string | undefined {
  const record = readRecord(update);
  if (record?._ !== 'updateConnectionState') {
    return undefined;
  }

  const state = readRecord(record.state);
  return typeof state?._ === 'string' ? state._ : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
