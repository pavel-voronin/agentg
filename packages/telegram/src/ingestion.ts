import type { TelegramDatabase as AppDatabase } from './database.js';
import {
  readControlPlaneAssetVersions,
  watchControlPlaneAssetVersion,
  type ControlPlaneAssetVersionSubscription
} from '@agentg/infra/control-plane/assets';
import { createServiceDirectoryClient } from '@agentg/service-directory/rpc';
import type { EventBus } from '@agentg/events/bus';
import { createIntegrationEvent } from '@agentg/events/envelope';
import { createValidatedEventBus } from '@agentg/events/validated-bus';
import { serviceManifestEventTypes } from '@agentg/rpc/call-event-types';
import {
  createTelegramIntegrationEvents,
  type TelegramChatDirectoryEvent
} from '@agentg/telegram/integration-events';

import {
  asTdObject,
  normalizeChat,
  normalizeTelegramUpdate,
  normalizeUser,
  type TdObject
} from './normalize.js';
import type { InternalTrpcBindConfig } from './rpc/config.js';
import { getDirectoryEntryByChatId } from './rpc/procedures/support.js';
import { createTelegramServiceManifest } from './registrations.js';
import {
  startTelegramTrpcServer,
  stopTelegramTrpcServer,
  TELEGRAM_CONTROL_PLANE_ASSETS_ROOT
} from './rpc/server.js';
import { persistCurrentTelegramUser, persistTelegramUpdate, upsertChat } from './store.js';
import {
  createTelegramClient,
  hasTelegramCredentials,
  type TelegramClientConfig
} from './tdlib.js';
import {
  invokeTdlibWithEvents,
  publishTdlibOperationEvents,
  publishTelegramOperationEvents
} from './telegram-operation-events.js';

export type TelegramIngestionOptions = {
  database: AppDatabase;
  eventBus: EventBus;
  internalRpc: InternalTrpcBindConfig;
  serviceRpcUrl: string;
  services: {
    serviceDirectory: {
      url: string;
    };
  };
  telegram: TelegramClientConfig;
};

type PersistenceStats = {
  chats: number;
  messages: number;
  rawEvents: number;
  users: number;
};

type TelegramClient = Awaited<ReturnType<typeof createTelegramClient>>;

type ChatListKind = 'main' | 'archive';

type TdlibStatusState = {
  authenticated: boolean;
  connected: boolean;
};

type TdlibStatusTracker = {
  markAuthenticated(authenticated: boolean): void;
  markConnectionState(connectionState: string): boolean;
  markDisconnected(): void;
  publish(): void;
};

const TDLIB_STATUS_HEARTBEAT_MS = 5000;
const TELEGRAM_SHUTDOWN_FORCE_EXIT_MS = 4500;
const TELEGRAM_SHUTDOWN_STEP_TIMEOUT_MS = 2000;

export async function runTelegramIngestion(options: TelegramIngestionOptions): Promise<void> {
  const initialControlPlaneAssets = await readControlPlaneAssetVersions(
    TELEGRAM_CONTROL_PLANE_ASSETS_ROOT
  );
  const serviceManifest = createTelegramServiceManifest({
    controlPlaneAssetVersion: initialControlPlaneAssets.version,
    controlPlaneAssetVersions: initialControlPlaneAssets.assets,
    rpcUrl: options.serviceRpcUrl
  });
  const eventBus = createValidatedEventBus(options.eventBus, {
    allowedTypes: serviceManifestEventTypes(serviceManifest),
    publisher: 'telegram'
  });
  let telegramRpcServer: Awaited<ReturnType<typeof startTelegramTrpcServer>> | undefined;
  let controlPlaneAssets: ControlPlaneAssetVersionSubscription | undefined;
  let serviceDirectory: ReturnType<typeof createServiceDirectoryClient> | undefined;
  let tdlibStatusHeartbeat: ReturnType<typeof setInterval> | undefined;
  let client: TelegramClient | undefined;
  let tdlibStatus: TdlibStatusTracker | undefined;
  let startupComplete = false;

  try {
    if (!hasTelegramCredentials(options.telegram)) {
      throw new Error('Telegram ingestion requires TELEGRAM_API_ID and TELEGRAM_API_HASH');
    }

    client = await createTelegramClient(options.telegram);
    const activeClient = client;
    const persistenceStats = createPersistenceStats();
    tdlibStatus = createTdlibStatusTracker(eventBus);
    const activeTdlibStatus = tdlibStatus;

    activeClient.on('error', (error: unknown) => {
      console.error(JSON.stringify({ event: 'telegram.error', error: String(error) }));
    });
    activeClient.on('update', (update: unknown) => {
      logSafeTelegramUpdate(update);
      handleTdlibConnectionUpdate(update, activeTdlibStatus);
      void persistLiveUpdate(options.database, update, persistenceStats, eventBus);
    });

    await publishTelegramOperationEvents(eventBus, 'login', {}, () => activeClient.login());
    await persistAndLogAuthenticatedClient(options.database, activeClient, eventBus);
    activeTdlibStatus.markAuthenticated(true);
    activeTdlibStatus.markConnectionState('connectionStateReady');
    tdlibStatusHeartbeat = startTdlibStatusHeartbeat(activeTdlibStatus);
    await syncInitialChats(options.database, activeClient, eventBus);

    telegramRpcServer = await startTelegramTrpcServer({
      bind: options.internalRpc,
      client: activeClient,
      database: options.database,
      eventBus
    });
    serviceDirectory = createServiceDirectoryClient({
      eventBus,
      onTopologyFailure: (error) => {
        requestProcessShutdown('telegram.topology_failure', error);
      },
      url: options.services.serviceDirectory.url
    });
    await serviceDirectory.join(serviceManifest);
    const activeServiceDirectory = serviceDirectory;
    controlPlaneAssets = watchControlPlaneAssetVersion({
      initialVersion: initialControlPlaneAssets,
      onError: (error) => {
        requestProcessShutdown('telegram.control_plane_assets_registration_failed', error);
      },
      onVersion: async (nextControlPlaneAssets) => {
        await activeServiceDirectory.join(
          createTelegramServiceManifest({
            controlPlaneAssetVersion: nextControlPlaneAssets.version,
            controlPlaneAssetVersions: nextControlPlaneAssets.assets,
            rpcUrl: options.serviceRpcUrl
          })
        );
        console.log(
          JSON.stringify({
            event: 'telegram.control_plane_assets_registered',
            version: nextControlPlaneAssets.version
          })
        );
      },
      rootDir: TELEGRAM_CONTROL_PLANE_ASSETS_ROOT
    });
    startupComplete = true;

    console.log(JSON.stringify({ event: 'telegram.ingestion_ready' }));
    await waitForShutdown(async () => {
      controlPlaneAssets?.close();
      controlPlaneAssets = undefined;
      if (tdlibStatusHeartbeat !== undefined) {
        clearInterval(tdlibStatusHeartbeat);
        tdlibStatusHeartbeat = undefined;
      }
      activeTdlibStatus.markDisconnected();
      const activeTelegramRpcServer = telegramRpcServer;
      const telegramRpcClosed =
        activeTelegramRpcServer === undefined
          ? true
          : await runShutdownStep('telegram.trpc_close', () =>
              stopTelegramTrpcServer(activeTelegramRpcServer)
            );
      if (telegramRpcClosed) {
        telegramRpcServer = undefined;
      }
      serviceDirectory?.close();
      serviceDirectory = undefined;
      const tdlibClosed = await runShutdownStep('telegram.tdlib.close', () =>
        publishTdlibOperationEvents(eventBus, 'close', {}, () => activeClient.close())
      );
      const eventBusClosed = await runShutdownStep('telegram.event_bus_close', () =>
        eventBus.close()
      );

      return telegramRpcClosed && tdlibClosed && eventBusClosed;
    });
  } catch (error) {
    if (!startupComplete) {
      await cleanupTelegramStartupFailure({
        client,
        controlPlaneAssets,
        eventBus,
        serviceDirectory,
        tdlibStatus,
        tdlibStatusHeartbeat,
        telegramRpcServer
      });
    }
    throw error;
  }
}

async function cleanupTelegramStartupFailure(options: {
  client: TelegramClient | undefined;
  controlPlaneAssets: ControlPlaneAssetVersionSubscription | undefined;
  eventBus: EventBus;
  serviceDirectory: ReturnType<typeof createServiceDirectoryClient> | undefined;
  tdlibStatus: TdlibStatusTracker | undefined;
  tdlibStatusHeartbeat: ReturnType<typeof setInterval> | undefined;
  telegramRpcServer: Awaited<ReturnType<typeof startTelegramTrpcServer>> | undefined;
}): Promise<void> {
  options.controlPlaneAssets?.close();
  if (options.tdlibStatusHeartbeat !== undefined) {
    clearInterval(options.tdlibStatusHeartbeat);
  }
  await runShutdownStep('telegram.tdlib_status_startup_disconnect', () =>
    Promise.resolve(options.tdlibStatus?.markDisconnected())
  );

  const telegramRpcServer = options.telegramRpcServer;
  if (telegramRpcServer !== undefined) {
    await runShutdownStep('telegram.trpc_startup_close', () =>
      stopTelegramTrpcServer(telegramRpcServer)
    );
  }

  await runShutdownStep('telegram.service_directory_startup_close', () =>
    Promise.resolve(options.serviceDirectory?.close())
  );
  const client = options.client;
  if (client !== undefined) {
    await runShutdownStep('telegram.tdlib_startup_close', () =>
      publishTdlibOperationEvents(options.eventBus, 'close', {}, () => client.close())
    );
  }
  await runShutdownStep('telegram.event_bus_startup_close', () => options.eventBus.close());
}

function requestProcessShutdown(event: string, error: Error): void {
  console.error(
    JSON.stringify({
      error: error.message,
      event
    })
  );
  process.exitCode = 1;
  process.kill(process.pid, 'SIGTERM');
}

function startTdlibStatusHeartbeat(status: TdlibStatusTracker): ReturnType<typeof setInterval> {
  status.publish();
  return setInterval(() => {
    status.publish();
  }, TDLIB_STATUS_HEARTBEAT_MS);
}

function createTdlibStatusTracker(eventBus: EventBus): TdlibStatusTracker {
  const state: TdlibStatusState = {
    authenticated: false,
    connected: false
  };

  const publish = (): void => {
    eventBus.publish(
      createIntegrationEvent({
        data: {
          authenticated: state.authenticated,
          connected: state.connected
        },
        type: 'telegram.status'
      })
    );
  };

  return {
    markAuthenticated(authenticated: boolean): void {
      state.authenticated = authenticated;
      state.connected = authenticated;
      publish();
    },
    markConnectionState(connectionState: string): boolean {
      state.connected = state.authenticated;
      publish();
      return isTdlibLiveCoverageConnectionState(connectionState);
    },
    markDisconnected(): void {
      state.connected = false;
      publish();
    },
    publish
  };
}

async function persistAndLogAuthenticatedClient(
  database: AppDatabase,
  client: TelegramClient,
  eventBus: EventBus
): Promise<void> {
  const me = asTdObject(await invokeTdlib(eventBus, client, { _: 'getMe' }));
  const currentUser = normalizeUser(me, { isSelf: true });
  if (currentUser !== undefined) {
    await persistCurrentTelegramUser(database, currentUser);
  }

  const chats = asTdObject(
    await invokeTdlib(eventBus, client, {
      _: 'getChats',
      chat_list: { _: 'chatListMain' },
      limit: 20
    })
  );

  console.log(
    JSON.stringify({
      event: 'telegram.authenticated',
      me: summarizeCurrentUser(me),
      chatCount: Array.isArray(chats?.chat_ids) ? chats.chat_ids.length : 0
    })
  );
}

async function persistLiveUpdate(
  database: AppDatabase,
  update: unknown,
  stats: PersistenceStats,
  eventBus: EventBus
): Promise<void> {
  const normalized = normalizeTelegramUpdate(update);
  if (normalized?.event === undefined) {
    return;
  }

  const result = await persistTelegramUpdate(database, normalized);
  const chatDirectoryEvent =
    normalized.chat === undefined
      ? undefined
      : await createChatDirectoryEvent(database, normalized.chat.id);
  if (result.chat) {
    stats.chats += 1;
  }
  if (result.event) {
    stats.rawEvents += 1;
  }
  if (result.message) {
    stats.messages += 1;
  }
  if (result.user) {
    stats.users += 1;
  }

  for (const event of createTelegramIntegrationEvents(normalized, result, {
    ...(chatDirectoryEvent === undefined ? {} : { chatDirectoryEvent })
  })) {
    eventBus.publish(event);
  }

  if (stats.rawEvents > 0 && stats.rawEvents % 500 === 0) {
    console.log(
      JSON.stringify({
        event: 'telegram.persistence_summary',
        ...stats
      })
    );
  }
}

async function createChatDirectoryEvent(
  database: AppDatabase,
  chatId: string
): Promise<TelegramChatDirectoryEvent> {
  const chat = await getDirectoryEntryByChatId(database, chatId);
  return chat === null ? { chatId, kind: 'removed' } : { chat, kind: 'updated' };
}

function createPersistenceStats(): PersistenceStats {
  return {
    chats: 0,
    messages: 0,
    rawEvents: 0,
    users: 0
  };
}

function handleTdlibConnectionUpdate(update: unknown, status: TdlibStatusTracker): void {
  const connectionState = extractTdlibConnectionState(update);
  if (connectionState === undefined) {
    return;
  }

  status.markConnectionState(connectionState);
}

async function syncInitialChats(
  database: AppDatabase,
  client: TelegramClient,
  eventBus: EventBus,
  limit = 100
): Promise<void> {
  const chatIds = await getMainChatIds(eventBus, client, limit);
  let storedChatCount = 0;

  for (const chatId of chatIds) {
    const chat = normalizeChat(
      asTdObject(await invokeTdlib(eventBus, client, { _: 'getChat', chat_id: chatId }))
    );
    if (chat !== undefined && (await upsertChat(database, chat))) {
      storedChatCount += 1;
    }
  }

  console.log(
    JSON.stringify({
      event: 'telegram.initial_chats_synced',
      storedChatCount
    })
  );
}

async function getMainChatIds(
  eventBus: EventBus,
  client: TelegramClient,
  limit: number
): Promise<number[]> {
  return getChatIds(eventBus, client, 'main', limit);
}

async function getChatIds(
  eventBus: EventBus,
  client: TelegramClient,
  chatList: ChatListKind,
  limit: number
): Promise<number[]> {
  let chats: TdObject | undefined;
  try {
    chats = asTdObject(
      await invokeTdlib(eventBus, client, {
        _: 'getChats',
        chat_list: toTdChatList(chatList),
        limit
      })
    );
  } catch (error) {
    if (chatList === 'archive' && isTdlibNotFound(error)) {
      return [];
    }

    throw error;
  }

  return Array.isArray(chats?.chat_ids) ? chats.chat_ids.filter(isTelegramId) : [];
}

function toTdChatList(chatList: ChatListKind): TdObject {
  return chatList === 'main' ? { _: 'chatListMain' } : { _: 'chatListArchive' };
}

async function invokeTdlib(
  eventBus: EventBus,
  client: TelegramClient,
  request: TdObject
): Promise<unknown> {
  for (;;) {
    try {
      return await invokeTdlibWithEvents(eventBus, client, request);
    } catch (error) {
      const floodWaitSeconds = parseFloodWaitSeconds(error);
      if (floodWaitSeconds === undefined) {
        throw error;
      }

      console.warn(
        JSON.stringify({
          event: 'telegram.flood_wait',
          request: request._,
          seconds: floodWaitSeconds
        })
      );
      await delay((floodWaitSeconds + 1) * 1000);
    }
  }
}

function parseFloodWaitSeconds(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = /FLOOD(?:_PREMIUM)?_WAIT_(\d+)/.exec(message);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

function isTdlibNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) || message.includes('NOT_FOUND') || message.includes('Not Found');
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function runShutdownStep(name: string, step: () => Promise<void>): Promise<boolean> {
  try {
    await withTimeout(step(), TELEGRAM_SHUTDOWN_STEP_TIMEOUT_MS, name);
    return true;
  } catch (error) {
    console.warn(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: 'telegram.shutdown_step_failed',
        step: name
      })
    );
    return false;
  }
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number, name: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${name} timed out after ${String(milliseconds)}ms`));
        }, milliseconds);
        timeout.unref();
      })
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

async function waitForShutdown(close: () => Promise<boolean>): Promise<void> {
  await new Promise<void>((resolve) => {
    let shutdownStarted = false;
    const shutdown = (signal: NodeJS.Signals): void => {
      if (shutdownStarted) {
        console.warn(
          JSON.stringify({
            event: 'telegram.shutdown_repeated_signal',
            signal
          })
        );
        return;
      }

      shutdownStarted = true;
      console.log(
        JSON.stringify({
          event: 'telegram.shutdown_started',
          signal
        })
      );

      const forceExit = setTimeout(() => {
        console.error(
          JSON.stringify({
            event: 'telegram.shutdown_forced_exit',
            timeoutMs: TELEGRAM_SHUTDOWN_FORCE_EXIT_MS
          })
        );
        process.exit(130);
      }, TELEGRAM_SHUTDOWN_FORCE_EXIT_MS);
      forceExit.unref();

      void close()
        .then((clean) => {
          clearTimeout(forceExit);
          if (!clean) {
            console.warn(JSON.stringify({ event: 'telegram.shutdown_incomplete' }));
            process.exit(130);
            return;
          }
          resolve();
        })
        .catch((error: unknown) => {
          clearTimeout(forceExit);
          console.error(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              event: 'telegram.shutdown_failed'
            })
          );
          process.exit(130);
        });
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  });
}

function logSafeTelegramUpdate(update: unknown): void {
  const tdObject = asTdObject(update);
  if (tdObject === undefined) {
    return;
  }

  if (tdObject._ === 'updateAuthorizationState') {
    const authorizationState = asTdObject(tdObject.authorization_state);
    console.log(
      JSON.stringify({
        event: 'telegram.authorization_state',
        state: authorizationState?._ ?? 'unknown'
      })
    );
    return;
  }

  if (tdObject._ === 'updateConnectionState') {
    const connectionState = asTdObject(tdObject.state);
    console.log(
      JSON.stringify({
        event: 'telegram.connection_state',
        state: connectionState?._ ?? 'unknown'
      })
    );
  }
}

function extractTdlibConnectionState(update: unknown): string | undefined {
  const tdObject = asTdObject(update);
  if (tdObject?._ !== 'updateConnectionState') {
    return undefined;
  }

  const connectionState = asTdObject(tdObject.state);
  return typeof connectionState?._ === 'string' ? connectionState._ : undefined;
}

function isTdlibLiveCoverageConnectionState(connectionState: string): boolean {
  return connectionState === 'connectionStateReady';
}

function summarizeCurrentUser(user: TdObject | undefined): Record<string, unknown> {
  return {
    id: user?.id,
    firstName: user?.first_name,
    lastName: user?.last_name,
    username: extractActiveUsername(user),
    isPremium: user?.is_premium
  };
}

function extractActiveUsername(user: TdObject | undefined): string | undefined {
  const usernames = asRecord(user?.usernames);
  const activeUsernames = usernames?.active_usernames;

  return Array.isArray(activeUsernames) && typeof activeUsernames[0] === 'string'
    ? activeUsernames[0]
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function isTelegramId(value: unknown): value is number {
  return typeof value === 'number';
}
