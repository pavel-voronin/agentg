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
import type { InternalTrpcBindConfig } from './rpc/config.js';
import { createTelegramServiceManifest } from './registrations.js';
import {
  startTelegramTrpcServer,
  stopTelegramTrpcServer,
  TELEGRAM_CONTROL_PLANE_ASSETS_ROOT
} from './rpc/server.js';
import {
  createTelegramClient,
  hasTelegramCredentials,
  type TelegramClientConfig
} from './tdlib.js';
import {
  invokeTdlibWithEvents,
  type TdlibInvokeOptions,
  publishTdlibOperationEvents,
  publishTelegramOperationEvents
} from './telegramOperationEvents.js';
import { telegramTdlibPriorities } from './telegramTdlibPriority.js';
import {
  createTelegramFileSubsystem,
  type TelegramFileSubsystem
} from './telegramFileSubsystem.js';
import {
  createTelegramTdlibScheduler,
  type TelegramTdlibScheduler
} from './telegramTdlibScheduler.js';
import {
  createTelegramLiveCoverageObserver,
  type TelegramLiveCoverageObserver
} from './telegramLiveCoverage.js';
import { createTelegramUpdateEventPublishers } from './telegram-events/updateEventPublishers.js';
import { handleUpdateAuthorizationState } from './tdlib-update-handlers/updateAuthorizationState.js';
import { handleUpdateChatLastMessage } from './tdlib-update-handlers/updateChatLastMessage.js';
import { handleUpdateChatFolders } from './tdlib-update-handlers/updateChatFolders.js';
import { handleUpdateConnectionState } from './tdlib-update-handlers/updateConnectionState.js';
import { handleUpdateDeleteMessages } from './tdlib-update-handlers/updateDeleteMessages.js';
import { handleUpdateFile } from './tdlib-update-handlers/updateFile.js';
import { handleUpdateMessageContent } from './tdlib-update-handlers/updateMessageContent.js';
import { handleUpdateNewChat } from './tdlib-update-handlers/updateNewChat.js';
import { handleUpdateNewMessage } from './tdlib-update-handlers/updateNewMessage.js';
import { handleUpdateUser } from './tdlib-update-handlers/updateUser.js';
import { recordChatFiles, storeChat } from './telegram-store/chat.js';
import { recordMessageFiles, storeMessage } from './telegram-store/message.js';
import { storeUser } from './telegram-store/user.js';
import type {
  TelegramWireChat,
  TelegramWireChats,
  TelegramWireObject,
  TelegramWireUpdate,
  TelegramWireUser
} from './telegramWire.js';

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
  let fileSubsystem: TelegramFileSubsystem | undefined;
  let liveCoverageObserver: TelegramLiveCoverageObserver | undefined;
  let liveCoverageTick: ReturnType<typeof setInterval> | undefined;
  let tdlibScheduler: TelegramTdlibScheduler | undefined;
  let client: TelegramClient | undefined;
  let tdlibStatus: TdlibStatusTracker | undefined;
  let startupComplete = false;

  try {
    if (!hasTelegramCredentials(options.telegram)) {
      throw new Error('Telegram ingestion requires TELEGRAM_API_ID and TELEGRAM_API_HASH');
    }

    client = await createTelegramClient(options.telegram);
    const activeClient = client;
    tdlibScheduler = createTelegramTdlibScheduler(activeClient);
    const activeTdlibScheduler = tdlibScheduler;
    fileSubsystem = createTelegramFileSubsystem({
      client: activeTdlibScheduler,
      database: options.database,
      eventBus,
      filesDirectory: options.telegram.filesDirectory
    });
    const activeFileSubsystem = fileSubsystem;
    const updateEventPublishers = createTelegramUpdateEventPublishers(eventBus, options.database);
    tdlibStatus = createTdlibStatusTracker(eventBus);
    const activeTdlibStatus = tdlibStatus;
    liveCoverageObserver = createTelegramLiveCoverageObserver({
      database: options.database,
      eventBus
    });
    const activeLiveCoverageObserver = liveCoverageObserver;

    activeClient.on('error', (error: unknown) => {
      console.error(JSON.stringify({ event: 'telegram.error', error: String(error) }));
    });
    activeClient.on('update', (update) => {
      void persistLiveUpdate(
        options.database,
        update,
        updateEventPublishers,
        activeFileSubsystem,
        activeLiveCoverageObserver,
        activeTdlibStatus
      );
    });

    await publishTelegramOperationEvents(eventBus, 'login', {}, () => activeClient.login());
    await persistAndLogAuthenticatedClient(options.database, activeTdlibScheduler, eventBus);
    activeTdlibStatus.markAuthenticated(true);
    activeTdlibStatus.markConnectionState('connectionStateReady');
    await activeLiveCoverageObserver.markConnected();
    tdlibStatusHeartbeat = startTdlibStatusHeartbeat(activeTdlibStatus);
    liveCoverageTick = setInterval(() => {
      void activeLiveCoverageObserver.tick();
    }, TDLIB_STATUS_HEARTBEAT_MS);
    await syncInitialChats(options.database, activeTdlibScheduler, eventBus, activeFileSubsystem);

    telegramRpcServer = await startTelegramTrpcServer({
      bind: options.internalRpc,
      client: activeTdlibScheduler,
      database: options.database,
      eventBus,
      files: activeFileSubsystem,
      filesDirectory: options.telegram.filesDirectory
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
      if (liveCoverageTick !== undefined) {
        clearInterval(liveCoverageTick);
        liveCoverageTick = undefined;
      }
      fileSubsystem?.close();
      fileSubsystem = undefined;
      activeTdlibScheduler.close();
      tdlibScheduler = undefined;
      await activeLiveCoverageObserver.markDisconnected();
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
      const [liveCoverageStopped, eventBusClosed] = await Promise.all([
        runShutdownStep('telegram.live_coverage_wait', () => activeLiveCoverageObserver.wait()),
        runShutdownStep('telegram.event_bus_close', () => eventBus.close())
      ]);

      return telegramRpcClosed && tdlibClosed && liveCoverageStopped && eventBusClosed;
    });
  } catch (error) {
    if (!startupComplete) {
      await cleanupTelegramStartupFailure({
        client,
        controlPlaneAssets,
        eventBus,
        fileSubsystem,
        liveCoverageObserver,
        liveCoverageTick,
        serviceDirectory,
        tdlibStatus,
        tdlibScheduler,
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
  fileSubsystem: TelegramFileSubsystem | undefined;
  liveCoverageObserver: TelegramLiveCoverageObserver | undefined;
  liveCoverageTick: ReturnType<typeof setInterval> | undefined;
  serviceDirectory: ReturnType<typeof createServiceDirectoryClient> | undefined;
  tdlibStatus: TdlibStatusTracker | undefined;
  tdlibScheduler: TelegramTdlibScheduler | undefined;
  tdlibStatusHeartbeat: ReturnType<typeof setInterval> | undefined;
  telegramRpcServer: Awaited<ReturnType<typeof startTelegramTrpcServer>> | undefined;
}): Promise<void> {
  options.controlPlaneAssets?.close();
  if (options.tdlibStatusHeartbeat !== undefined) {
    clearInterval(options.tdlibStatusHeartbeat);
  }
  if (options.liveCoverageTick !== undefined) {
    clearInterval(options.liveCoverageTick);
  }
  options.fileSubsystem?.close();
  options.tdlibScheduler?.close();
  await runShutdownStep('telegram.live_coverage_startup_disconnect', () =>
    Promise.resolve(options.liveCoverageObserver?.markDisconnected())
  );
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
  await Promise.all([
    runShutdownStep('telegram.live_coverage_startup_wait', () =>
      Promise.resolve(options.liveCoverageObserver?.wait())
    ),
    runShutdownStep('telegram.event_bus_startup_close', () => options.eventBus.close())
  ]);
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
  client: TelegramTdlibScheduler,
  eventBus: EventBus
): Promise<void> {
  const me = (await invokeTdlib(
    eventBus,
    client,
    { _: 'getMe' },
    { priority: telegramTdlibPriorities.maximum }
  )) as TelegramWireUser;
  await storeUser(database, me);

  const chats = (await invokeTdlib(
    eventBus,
    client,
    {
      _: 'getChats',
      chat_list: { _: 'chatListMain' },
      limit: 20
    },
    { priority: telegramTdlibPriorities.maximum }
  )) as TelegramWireChats;

  console.log(
    JSON.stringify({
      event: 'telegram.authenticated',
      me: summarizeCurrentUser(me),
      chatCount: chats.chat_ids.length
    })
  );
}

async function persistLiveUpdate(
  database: AppDatabase,
  update: TelegramWireUpdate,
  updateEventPublishers: ReturnType<typeof createTelegramUpdateEventPublishers>,
  files: TelegramFileSubsystem,
  liveCoverageObserver: TelegramLiveCoverageObserver,
  tdlibStatus: TdlibStatusTracker
): Promise<void> {
  const context = {
    database,
    events: updateEventPublishers,
    files,
    liveCoverageObserver,
    tdlibStatus
  };

  switch (update._) {
    case 'updateAuthorizationState':
      handleUpdateAuthorizationState(update);
      return;
    case 'updateChatLastMessage':
      await handleUpdateChatLastMessage(context, update);
      return;
    case 'updateChatFolders':
      await handleUpdateChatFolders(context, update);
      return;
    case 'updateConnectionState':
      await handleUpdateConnectionState(context, update);
      return;
    case 'updateDeleteMessages':
      await handleUpdateDeleteMessages(context, update);
      return;
    case 'updateFile':
      await handleUpdateFile(context, update);
      return;
    case 'updateMessageContent':
      await handleUpdateMessageContent(context, update);
      return;
    case 'updateNewChat':
      await handleUpdateNewChat(context, update);
      return;
    case 'updateNewMessage':
      await handleUpdateNewMessage(context, update);
      return;
    case 'updateUser':
      await handleUpdateUser(context, update);
      return;
  }

  console.error(
    JSON.stringify({
      event: 'telegram.tdlib_update_unhandled',
      updateType: update._
    })
  );
}

async function syncInitialChats(
  database: AppDatabase,
  client: TelegramTdlibScheduler,
  eventBus: EventBus,
  files: TelegramFileSubsystem,
  limit = 100
): Promise<void> {
  const chatIds = await getMainChatIds(eventBus, client, limit);
  let storedChatCount = 0;

  for (const chatId of chatIds) {
    const chat = (await invokeTdlib(
      eventBus,
      client,
      { _: 'getChat', chat_id: chatId },
      {
        priority: telegramTdlibPriorities.maximum
      }
    )) as TelegramWireChat;
    const lastMessage = chat.last_message ?? null;
    await database.transaction(async (transaction) => {
      if (lastMessage !== null) {
        await storeMessage(transaction, lastMessage);
      }

      await storeChat(transaction, chat);
    });

    await recordChatFiles(files, chat, 'initialization');
    if (lastMessage !== null) {
      await recordMessageFiles(files, lastMessage, 'initialization');
    }
    storedChatCount += 1;
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
  client: TelegramTdlibScheduler,
  limit: number
): Promise<number[]> {
  return getChatIds(eventBus, client, 'main', limit);
}

async function getChatIds(
  eventBus: EventBus,
  client: TelegramTdlibScheduler,
  chatList: ChatListKind,
  limit: number
): Promise<number[]> {
  let chats: TelegramWireChats | undefined;
  try {
    chats = (await invokeTdlib(
      eventBus,
      client,
      {
        _: 'getChats',
        chat_list: toTdChatList(chatList),
        limit
      },
      { priority: telegramTdlibPriorities.maximum }
    )) as TelegramWireChats;
  } catch (error) {
    if (chatList === 'archive' && isTdlibNotFound(error)) {
      return [];
    }

    throw error;
  }

  return chats.chat_ids;
}

function toTdChatList(chatList: ChatListKind): TelegramWireObject {
  return chatList === 'main' ? { _: 'chatListMain' } : { _: 'chatListArchive' };
}

async function invokeTdlib(
  eventBus: EventBus,
  client: TelegramTdlibScheduler,
  request: TelegramWireObject,
  options: TdlibInvokeOptions = {}
): Promise<unknown> {
  for (;;) {
    try {
      return await invokeTdlibWithEvents(eventBus, client, request, {
        ...options
      });
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
          if (clean) {
            resolve();
            return;
          }
          console.warn(JSON.stringify({ event: 'telegram.shutdown_incomplete' }));
          process.exit(130);
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

function isTdlibLiveCoverageConnectionState(connectionState: string): boolean {
  return connectionState === 'connectionStateReady';
}

function summarizeCurrentUser(user: TelegramWireUser): Record<string, unknown> {
  return {
    id: String(user.id),
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.usernames?.active_usernames[0],
    isPremium: user.is_premium
  };
}
