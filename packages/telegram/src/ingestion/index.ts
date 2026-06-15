import {
  createLogger,
  type EventBus,
  logError,
  recordTelemetryHistogram,
  timeTelemetrySpan
} from '@agentg/framework';

import type { AccountIdentity } from '../account/index.js';
import type { Database } from '../database/client.js';
import type { FileSubsystem } from '../files/index.js';
import type { RestoreService } from '../gap-restore/runtime.js';
import type { LiveCoverageObserver } from '../history/liveCoverage.js';
import { createRepositories } from '../repositories/repositories.js';
import type { StatusTracker } from '../status/tracker.js';
import { startIngestionQueueTelemetry } from './queueTelemetry.js';
import type { IngestionResources } from './resources.js';
import { applyIngestionChanges } from './applyChanges.js';
import { applyIngestionChangesToDatabase } from './applyChanges.js';
import { savedChatChanges } from './adapters/chat.js';
import { chatFileSlots, messageFileSlots } from './adapters/fileSlot.js';
import { chatListInputFromKind, type InitialChatListKind } from './adapters/initialSync.js';
import { savedUserChanges } from './adapters/user.js';
import { persistLiveUpdate } from './adapters/catalog.js';
import { recordHandledUpdateCatalog, recordUpdateSeen } from './updateCatalogTelemetry.js';
import { createUpdateQueue } from './updateQueue.js';

type IngestionRuntime = {
  start(): Promise<() => Promise<undefined>>;
};

type InitialChat = Parameters<typeof savedChatChanges>[0];
type InitialChatListInput = ReturnType<typeof chatListInputFromKind>;
type InitialUser = Parameters<typeof savedUserChanges>[0];
type IngestionOperationOptions = {
  priority?: number;
};
export type IngestionOperationPort = {
  getChat(input: { chatId: number }, options?: IngestionOperationOptions): Promise<InitialChat>;
  getChats(
    input: { chatList: InitialChatListInput; limit: number },
    options?: IngestionOperationOptions
  ): Promise<{ chat_ids: number[] }>;
  getMe(options?: IngestionOperationOptions): Promise<InitialUser>;
  loadChats(
    input: { chatList: InitialChatListInput; limit: number },
    options?: IngestionOperationOptions
  ): Promise<unknown>;
  onUpdate(handler: (update: RuntimeUpdate) => void | Promise<void>): () => void;
};

export type IngestionOptions = {
  account: AccountIdentity;
  database: Database;
  events: EventBus;
  files: FileSubsystem;
  gapRestore: RestoreService;
  liveCoverage: LiveCoverageObserver;
  operations: IngestionOperationPort;
  status: StatusTracker;
  updateConcurrency: number;
};

const LIVE_COVERAGE_TICK_MS = 30_000;
const STATUS_HEARTBEAT_MS = 5000;
const INITIAL_CHAT_SYNC_LIMIT = 100;
const METRIC_UPDATE_PROCESSING_DURATION = 'telegram.update.processing.duration';
const METRIC_UPDATE_QUEUE_WAIT_DURATION = 'telegram.ingestion.queue.wait.duration';
const MAXIMUM_OPERATION_PRIORITY = 32;
const logger = createLogger('telegram');

type RuntimeUpdate = {
  readonly _: string;
};

export function useIngestion(options: IngestionOptions): IngestionRuntime {
  const resources: IngestionResources = {
    account: options.account.identity,
    database: options.database,
    events: options.events,
    files: options.files,
    liveCoverage: options.liveCoverage,
    status: options.status
  };
  const updates = createUpdateQueue<RuntimeUpdate>({
    concurrency: options.updateConcurrency,
    handle: (update) =>
      timeTelemetrySpan(
        {
          attributes: {
            'telegram.update.source': 'tdlib',
            'telegram.update.type': update._
          },
          metric: {
            attributes: {
              'telegram.update.source': 'tdlib',
              'telegram.update.type': update._
            },
            name: METRIC_UPDATE_PROCESSING_DURATION
          },
          name: update._
        },
        async () => persistLiveUpdate(update, resources)
      ),
    onStart(update, waitSeconds): void {
      recordTelemetryHistogram(
        METRIC_UPDATE_QUEUE_WAIT_DURATION,
        waitSeconds,
        {
          'telegram.update.source': 'tdlib',
          'telegram.update.type': update._
        },
        { unit: 's' }
      );
    },
    onError(error, update): void {
      logger.error(
        {
          event: 'telegram.tdlib_update_persist_failed',
          updateType: update._,
          ...logError(error)
        },
        'telegram tdlib update persist failed'
      );
    }
  });
  const unsubscribeUpdates = options.operations.onUpdate((update) => {
    recordUpdateSeen(update._);
    updates.enqueue(update);
  });
  let stopQueueTelemetry: (() => undefined) | undefined;
  let liveCoverageTick: ReturnType<typeof setInterval> | undefined;
  let statusHeartbeat: ReturnType<typeof setInterval> | undefined;

  return {
    async start() {
      stopQueueTelemetry = startIngestionQueueTelemetry({
        concurrency: options.updateConcurrency,
        snapshot: () => updates.snapshot()
      });
      recordHandledUpdateCatalog();
      await persistAuthenticatedClient(options);
      options.status.markAuthenticated(true);
      options.status.markConnectionState('connectionStateReady');
      await options.liveCoverage.markConnected();
      statusHeartbeat = setInterval(() => {
        options.status.publish();
      }, STATUS_HEARTBEAT_MS);
      statusHeartbeat.unref();
      await syncInitialChats(options, resources);
      await updates.drain();
      await options.liveCoverage.markConnected();
      await options.liveCoverage.syncKnownChats();
      await options.liveCoverage.wait();
      await options.gapRestore.restore();
      liveCoverageTick = setInterval(() => {
        void options.liveCoverage.tick();
      }, LIVE_COVERAGE_TICK_MS);
      liveCoverageTick.unref();
      options.status.markReady(true);

      return stop;
    }
  };

  async function stop(): Promise<undefined> {
    options.status.markReady(false);
    if (liveCoverageTick !== undefined) {
      clearInterval(liveCoverageTick);
      liveCoverageTick = undefined;
    }
    if (statusHeartbeat !== undefined) {
      clearInterval(statusHeartbeat);
      statusHeartbeat = undefined;
    }
    unsubscribeUpdates();
    await updates.drain();
    stopQueueTelemetry?.();
    stopQueueTelemetry = undefined;
    await options.liveCoverage.markDisconnected();
    options.status.markDisconnected();
    options.account.clear();
    await options.liveCoverage.wait();
    return undefined;
  }
}

async function persistAuthenticatedClient(options: IngestionOptions): Promise<void> {
  const me = await options.operations.getMe({ priority: MAXIMUM_OPERATION_PRIORITY });
  options.account.setUserId(me.id);
  await applyIngestionChanges(
    {
      account: options.account.identity,
      database: options.database,
      events: options.events,
      files: options.files,
      liveCoverage: options.liveCoverage,
      status: options.status
    },
    savedUserChanges(me)
  );

  const chats = await options.operations.getChats(
    {
      chatList: { _: 'chatListMain' },
      limit: 20
    },
    { priority: MAXIMUM_OPERATION_PRIORITY }
  );

  logger.info(
    {
      chatCount: chats.chat_ids.length,
      event: 'telegram.authenticated',
      me: {
        firstName: me.first_name,
        id: String(me.id),
        isPremium: me.is_premium,
        lastName: me.last_name,
        username: me.usernames?.active_usernames[0]
      }
    },
    'telegram authenticated'
  );
}

async function syncInitialChats(
  options: IngestionOptions,
  resources: IngestionResources
): Promise<void> {
  const folderIds = await createRepositories(options.database).chatFolders.listKnownFolderIds();
  const chatLists: InitialChatListKind[] = [
    { kind: 'main' },
    { kind: 'archive' },
    ...folderIds.map((folderId) => ({ folderId, kind: 'folder' as const }))
  ];
  const loadedChatIds: number[] = [];
  for (const chatList of chatLists) {
    loadedChatIds.push(...(await syncInitialChatList(options, chatList, INITIAL_CHAT_SYNC_LIMIT)));
  }
  const chatIds = dedupeChatIds(loadedChatIds);
  let storedChatCount = 0;

  for (const chatId of chatIds) {
    const chat = await options.operations.getChat(
      {
        chatId
      },
      {
        priority: MAXIMUM_OPERATION_PRIORITY
      }
    );
    await options.database.transaction(async (transaction) => {
      await applyIngestionChangesToDatabase(resources, transaction, savedChatChanges(chat));
    });

    const lastMessage = chat.last_message ?? null;
    await options.files.recordFileSlots(chatFileSlots(chat), 'initialization');
    if (lastMessage !== null) {
      await options.files.recordFileSlots(messageFileSlots(lastMessage), 'initialization');
    }
    storedChatCount += 1;
  }

  logger.info(
    {
      event: 'telegram.initial_chats_synced',
      folderCount: folderIds.length,
      listCount: chatLists.length,
      storedChatCount
    },
    'telegram initial chats synced'
  );
}

async function syncInitialChatList(
  options: IngestionOptions,
  chatList: InitialChatListKind,
  limit: number
): Promise<number[]> {
  await loadInitialChats(chatList, limit, options);
  return getInitialChatIds(chatList, limit, options);
}

async function loadInitialChats(
  chatList: InitialChatListKind,
  limit: number,
  options: IngestionOptions
): Promise<void> {
  for (;;) {
    try {
      await options.operations.loadChats(
        {
          chatList: chatListInputFromKind(chatList),
          limit
        },
        { priority: MAXIMUM_OPERATION_PRIORITY }
      );
    } catch (error) {
      if (isTdlibNotFound(error)) {
        return;
      }
      throw error;
    }
  }
}

async function getInitialChatIds(
  chatList: InitialChatListKind,
  limit: number,
  options: IngestionOptions
): Promise<number[]> {
  try {
    const chats = await options.operations.getChats(
      {
        chatList: chatListInputFromKind(chatList),
        limit
      },
      { priority: MAXIMUM_OPERATION_PRIORITY }
    );
    return chats.chat_ids;
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return [];
    }
    throw error;
  }
}

function dedupeChatIds(chatIds: number[]): number[] {
  return [...new Set(chatIds)];
}

function isTdlibNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) || message.includes('NOT_FOUND') || message.includes('Not Found');
}
