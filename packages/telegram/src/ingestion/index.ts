import {
  createLogger,
  logError,
  recordTelemetryHistogram,
  timeTelemetrySpan,
  type EventBus
} from '@agentg/framework';
import { asc } from 'drizzle-orm';
import type { ChatList$Input } from 'tdlib-types';

import type { AccountIdentity } from '../account/index.js';
import type { Database } from '../database/client.js';
import { telegramChatFolderInfos } from '../database/schema.js';
import type { FileSubsystem } from '../files/index.js';
import { recordChatFiles, storeChat } from '../store/chat.js';
import { recordMessageFiles, storeMessage } from '../store/message.js';
import { storeUser } from '../store/user.js';
import type { Tdlib } from '../tdlib/index.js';
import { priorities } from '../tdlib/priority.js';
import type { LiveCoverageObserver } from '../history/liveCoverage.js';
import type { StatusTracker } from '../status/tracker.js';
import { createUpdateEvents } from './events.js';
import { startIngestionQueueTelemetry } from './queueTelemetry.js';
import type { IngestionResources } from './resources.js';
import { persistLiveUpdate } from './registry.js';
import { recordHandledUpdateCatalog, recordUpdateSeen } from './updateCatalogTelemetry.js';
import { createUpdateQueue } from './updateQueue.js';

type IngestionRuntime = {
  start(): Promise<() => Promise<undefined>>;
};

export type IngestionOptions = {
  account: AccountIdentity;
  database: Database;
  events: EventBus;
  files: FileSubsystem;
  liveCoverage: LiveCoverageObserver;
  status: StatusTracker;
  tdlib: Tdlib;
  updateConcurrency: number;
};

const LIVE_COVERAGE_TICK_MS = 30_000;
const STATUS_HEARTBEAT_MS = 5000;
const INITIAL_CHAT_SYNC_LIMIT = 100;
const METRIC_UPDATE_PROCESSING_DURATION = 'telegram.update.processing.duration';
const METRIC_UPDATE_QUEUE_WAIT_DURATION = 'telegram.ingestion.queue.wait.duration';
const logger = createLogger('telegram');

type ChatListKind =
  | {
      kind: 'archive' | 'main';
    }
  | {
      folderId: number;
      kind: 'folder';
    };

type RuntimeUpdate = {
  readonly _: string;
};

export function useIngestion(options: IngestionOptions): IngestionRuntime {
  const resources: IngestionResources = {
    account: options.account.identity,
    database: options.database,
    events: createUpdateEvents(options.events),
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
  const unsubscribeUpdates = options.tdlib.onUpdate((update) => {
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
      await syncInitialChats(options);
      await options.liveCoverage.syncKnownChats();
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
  const me = await options.tdlib.getMe({ priority: priorities.maximum });
  options.account.setUserId(me.id);
  await storeUser(options.database, me);

  const chats = await options.tdlib.getChats(
    {
      chatList: { _: 'chatListMain' },
      limit: 20
    },
    { priority: priorities.maximum }
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

async function syncInitialChats(options: IngestionOptions): Promise<void> {
  const folderIds = await listKnownFolderIds(options.database);
  const chatLists: ChatListKind[] = [
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
    const chat = await options.tdlib.getChat(
      {
        chatId
      },
      {
        priority: priorities.maximum
      }
    );
    const lastMessage = chat.last_message ?? null;
    await options.database.transaction(async (transaction) => {
      if (lastMessage !== null) {
        await storeMessage(transaction, lastMessage);
      }

      await storeChat(transaction, chat);
    });

    await recordChatFiles(options.files, chat, 'initialization');
    if (lastMessage !== null) {
      await recordMessageFiles(options.files, lastMessage, 'initialization');
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
  chatList: ChatListKind,
  limit: number
): Promise<number[]> {
  await loadInitialChats(chatList, limit, options);
  return getInitialChatIds(chatList, limit, options);
}

async function loadInitialChats(
  chatList: ChatListKind,
  limit: number,
  options: IngestionOptions
): Promise<void> {
  for (;;) {
    try {
      await options.tdlib.loadChats(
        {
          chatList: toTdChatList(chatList),
          limit
        },
        { priority: priorities.maximum }
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
  chatList: ChatListKind,
  limit: number,
  options: IngestionOptions
): Promise<number[]> {
  try {
    const chats = await options.tdlib.getChats(
      {
        chatList: toTdChatList(chatList),
        limit
      },
      { priority: priorities.maximum }
    );
    return chats.chat_ids;
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return [];
    }
    throw error;
  }
}

async function listKnownFolderIds(database: Database): Promise<number[]> {
  const rows = await database
    .select({
      folderId: telegramChatFolderInfos.id
    })
    .from(telegramChatFolderInfos)
    .orderBy(asc(telegramChatFolderInfos.position), asc(telegramChatFolderInfos.id));

  return rows.map((row) => row.folderId);
}

function toTdChatList(chatList: ChatListKind): ChatList$Input {
  switch (chatList.kind) {
    case 'main':
      return { _: 'chatListMain' };
    case 'archive':
      return { _: 'chatListArchive' };
    case 'folder':
      return { _: 'chatListFolder', chat_folder_id: chatList.folderId };
  }
}

function dedupeChatIds(chatIds: number[]): number[] {
  return [...new Set(chatIds)];
}

function isTdlibNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) || message.includes('NOT_FOUND') || message.includes('Not Found');
}
