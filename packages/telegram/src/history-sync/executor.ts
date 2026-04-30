import type { AppDatabase } from '@agentg/database/client';
import { telegramChats } from '@agentg/database/schema';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/shared/events/envelope';
import type { JsonObject } from '@agentg/shared/json';
import { asc } from 'drizzle-orm';

import {
  asTdObject,
  normalizeChat,
  normalizeHistoricalMessage,
  type NormalizedTelegramUpdate,
  type TdObject
} from '../normalize.js';
import { upsertChat } from '../store.js';
import { TELEGRAM_HISTORY_PAST_BOUNDARY } from './constants.js';
import { checkpointBackfillPage } from './jobs.js';
import { materializeTemplatesForChat } from './materialization.js';
import { completedOneShotTargets, reconcileChat } from './reconciler.js';
import {
  checkpointBackfillJob,
  claimNextBackfillJob,
  completeBackfillJob,
  createBackfillJobs,
  deleteHistoryTarget,
  listHistoryCoverage,
  listHistoryTargets,
  listHistoryTemplates,
  resetBackfillJob,
  resetRunningBackfillJobs,
  upsertHistoryTargets
} from './store.js';
import type { BackfillJob, HistoryTarget, TelegramChatForHistory } from './types.js';

type TelegramClient = {
  invoke(request: Record<string, unknown>): Promise<unknown>;
};

type ChatListKind = 'archive' | 'main';

export type HistorySyncOptions = {
  chatLoadBatchSize: number;
  discoverChats?: boolean;
  jobWindowDays: number;
  messageLimit: number;
  publishEvent?: (event: IntegrationEvent) => void;
  requestDelayMs: number;
};

type HistorySyncChat = TelegramChatForHistory & {
  numericId?: number;
};

type BackfillJobExecutionResult = {
  fetchedMessages: number;
  reachedBeginning: boolean;
  storedMessages: number;
};

export async function runHistorySync(
  database: AppDatabase,
  client: TelegramClient,
  options: HistorySyncOptions
): Promise<void> {
  const safeOptions = normalizeHistorySyncOptions(options);
  const reconcileNow = truncateToTelegramSecond(new Date());
  emitHistoryEvent(safeOptions, 'history.sync.started', {
    now: reconcileNow.toISOString()
  });
  const chats =
    safeOptions.discoverChats === true
      ? await discoverHistorySyncChats(database, client, safeOptions.chatLoadBatchSize)
      : await listKnownHistorySyncChats(database);
  const targets = await materializeHistoryTargets(database, chats);

  await resetRunningBackfillJobs(database);
  const createdJobs = await reconcileHistoryTargets(database, targets, reconcileNow, safeOptions);
  await executePendingBackfillJobs(database, client, reconcileNow, safeOptions);
  emitHistoryEvent(safeOptions, 'history.sync.completed', {
    chats: chats.length,
    createdJobs,
    targets: targets.length
  });
}

async function materializeHistoryTargets(
  database: AppDatabase,
  chats: HistorySyncChat[]
): Promise<HistoryTarget[]> {
  const templates = await listHistoryTemplates(database);
  let targets = await listHistoryTargets(database);
  for (const chat of chats) {
    targets = materializeTemplatesForChat(templates, chat, targets);
  }

  await upsertHistoryTargets(database, targets);
  return targets;
}

async function reconcileHistoryTargets(
  database: AppDatabase,
  targets: HistoryTarget[],
  now: Date,
  options: HistorySyncOptions
): Promise<number> {
  let createdJobs = 0;
  const chatIds = [...new Set(targets.map((target) => target.chatId))];
  let activeTargets = targets;

  for (const chatId of chatIds) {
    const coverage = await listHistoryCoverage(database, chatId);
    const completedTargets = completedOneShotTargets({
      chatId,
      coverage,
      jobWindowMilliseconds: options.jobWindowDays * 24 * 60 * 60 * 1000,
      literals: {
        past: TELEGRAM_HISTORY_PAST_BOUNDARY
      },
      now,
      targets: activeTargets
    });
    for (const target of completedTargets) {
      const deleted = await deleteHistoryTarget(database, target.id);
      if (deleted !== undefined) {
        activeTargets = activeTargets.filter((existing) => existing.id !== target.id);
        emitHistoryEvent(options, 'history.target.auto_deleted', {
          chatId: target.chatId,
          targetId: target.id
        });
      }
    }
    const jobs = reconcileChat({
      chatId,
      coverage,
      jobWindowMilliseconds: options.jobWindowDays * 24 * 60 * 60 * 1000,
      literals: {
        past: TELEGRAM_HISTORY_PAST_BOUNDARY
      },
      now,
      targets: activeTargets
    });

    createdJobs += await createBackfillJobs(database, jobs.slice(0, 1));
  }

  emitHistoryEvent(options, 'history.reconcile.completed', {
    chats: chatIds.length,
    createdJobs
  });

  return createdJobs;
}

async function executePendingBackfillJobs(
  database: AppDatabase,
  client: TelegramClient,
  now: Date,
  options: HistorySyncOptions
): Promise<void> {
  for (;;) {
    const job = await claimNextBackfillJob(database);
    if (job === undefined) {
      const targets = await listHistoryTargets(database);
      const createdJobs = await reconcileHistoryTargets(database, targets, now, options);
      if (createdJobs === 0) {
        console.log(JSON.stringify({ event: 'telegram.history_sync_complete' }));
        return;
      }
      continue;
    }

    const coverage = await listHistoryCoverage(database, job.chatId);
    if (
      coverage.some((interval) => interval.startAt <= job.startAt && interval.endAt >= job.endAt)
    ) {
      await completeBackfillJob(database, job, {
        chatId: job.chatId,
        endAt: job.endAt,
        startAt: job.startAt
      });
      continue;
    }

    try {
      emitHistoryEvent(options, 'history.job.started', {
        chatId: job.chatId,
        jobEnd: job.endAt.toISOString(),
        jobId: job.id,
        jobStart: job.startAt.toISOString()
      });
      const result = await executeBackfillJob(database, client, job, options);
      emitHistoryEvent(options, 'history.job.completed', {
        chatId: job.chatId,
        fetchedMessages: result.fetchedMessages,
        jobEnd: job.endAt.toISOString(),
        jobId: job.id,
        jobStart: job.startAt.toISOString(),
        reachedBeginning: result.reachedBeginning,
        storedMessages: result.storedMessages
      });

      console.log(
        JSON.stringify({
          event: 'telegram.history_backfill_job_complete',
          chatId: job.chatId,
          fetchedMessages: result.fetchedMessages,
          jobEnd: job.endAt.toISOString(),
          jobStart: job.startAt.toISOString(),
          reachedBeginning: result.reachedBeginning,
          storedMessages: result.storedMessages
        })
      );
    } catch (error) {
      await resetBackfillJob(database, job);
      emitHistoryEvent(options, 'history.job.failed', {
        chatId: job.chatId,
        error: error instanceof Error ? error.message : String(error),
        jobEnd: job.endAt.toISOString(),
        jobId: job.id,
        jobStart: job.startAt.toISOString()
      });
      throw error;
    }
  }
}

async function executeBackfillJob(
  database: AppDatabase,
  client: TelegramClient,
  job: BackfillJob,
  options: Pick<HistorySyncOptions, 'messageLimit' | 'publishEvent' | 'requestDelayMs'>
): Promise<BackfillJobExecutionResult> {
  const chatId = Number(job.chatId);
  if (!Number.isSafeInteger(chatId)) {
    throw new Error(`Telegram chat id must be numeric: ${job.chatId}`);
  }

  let remainingEndAt = job.endAt;
  let cursorMessageId = readCursorMessageId(job.cursor);
  if (cursorMessageId === undefined) {
    await delay(options.requestDelayMs);
    const anchor = await getLastMessageNoLaterThan(client, chatId, remainingEndAt);
    const anchorDate = tdMessageDate(anchor);
    const anchorMessageId = tdMessageId(anchor);

    if (anchor === undefined || anchorMessageId === undefined) {
      await completeJobWithCoverage(database, job, options, {
        endAt: remainingEndAt,
        startAt: TELEGRAM_HISTORY_PAST_BOUNDARY
      });
      return {
        fetchedMessages: 0,
        reachedBeginning: true,
        storedMessages: 0
      };
    }

    if (anchorDate !== undefined && anchorDate < job.startAt) {
      await completeJobWithCoverage(database, job, options, {
        endAt: remainingEndAt,
        startAt: job.startAt
      });
      return {
        fetchedMessages: 0,
        reachedBeginning: false,
        storedMessages: 0
      };
    }

    cursorMessageId = anchorMessageId;
  }

  let fetchedMessages = 0;
  let storedMessages = 0;
  let reachedBeginning = false;

  while (cursorMessageId !== undefined) {
    await delay(options.requestDelayMs);

    const history = asTdObject(
      await invokeTdlib(client, {
        _: 'getChatHistory',
        chat_id: chatId,
        from_message_id: cursorMessageId,
        limit: options.messageLimit,
        offset: 0,
        only_local: false
      })
    );

    const messages = Array.isArray(history?.messages) ? history.messages.map(asTdObject) : [];
    const concreteMessages = messages.filter(isTdObject);

    if (concreteMessages.length === 0) {
      reachedBeginning = true;
      await completeJobWithCoverage(database, job, options, {
        endAt: remainingEndAt,
        startAt: TELEGRAM_HISTORY_PAST_BOUNDARY
      });
      return {
        fetchedMessages,
        reachedBeginning,
        storedMessages
      };
    }

    fetchedMessages += concreteMessages.length;

    const updates: NormalizedTelegramUpdate[] = [];
    for (const message of concreteMessages) {
      const messageDate = tdMessageDate(message);
      if (messageDate === undefined || messageDate < job.startAt || messageDate >= remainingEndAt) {
        continue;
      }

      const normalized = normalizeHistoricalMessage(message);
      if (normalized !== undefined) {
        updates.push(normalized);
      }
    }

    const crossedStart = concreteMessages.some((message) => isBeforeInterval(message, job.startAt));
    const nextCursor = oldestMessageIdOlderThan(concreteMessages, cursorMessageId);
    reachedBeginning = nextCursor === undefined;
    const oldestFetchedMessageDate =
      nextCursor === undefined ? undefined : messageDateForId(concreteMessages, nextCursor);
    const checkpoint = checkpointBackfillPage(job, {
      crossedStart,
      ...(oldestFetchedMessageDate === undefined ? {} : { oldestFetchedMessageDate }),
      reachedBeginning,
      remainingEndAt
    });
    const result = await checkpointBackfillJob(database, job, {
      complete: checkpoint.complete,
      ...(checkpoint.coveredInterval === undefined
        ? {}
        : { coveredInterval: checkpoint.coveredInterval }),
      ...(checkpoint.complete || nextCursor === undefined
        ? {}
        : { cursor: { messageId: nextCursor } }),
      ...(checkpoint.complete ? {} : { remainingEndAt: checkpoint.remainingEndAt }),
      updates
    });
    storedMessages += result.storedMessages;

    if (checkpoint.coveredInterval !== undefined) {
      emitCoverageChanged(options, checkpoint.coveredInterval);
    }

    if (nextCursor === undefined) {
      return {
        fetchedMessages,
        reachedBeginning,
        storedMessages
      };
    }

    if (checkpoint.complete) {
      return {
        fetchedMessages,
        reachedBeginning,
        storedMessages
      };
    }

    cursorMessageId = nextCursor;
    remainingEndAt = checkpoint.remainingEndAt;
    emitHistoryEvent(options, 'history.job.progress', {
      chatId: job.chatId,
      cursorMessageId,
      fetchedMessages,
      jobEnd: remainingEndAt.toISOString(),
      jobId: job.id,
      jobStart: job.startAt.toISOString(),
      storedMessages
    });
  }

  return {
    fetchedMessages,
    reachedBeginning,
    storedMessages
  };
}

async function completeJobWithCoverage(
  database: AppDatabase,
  job: BackfillJob,
  options: Pick<HistorySyncOptions, 'publishEvent'>,
  interval: {
    endAt: Date;
    startAt: Date;
  }
): Promise<void> {
  const coveredInterval = {
    chatId: job.chatId,
    endAt: interval.endAt,
    startAt: interval.startAt
  };
  await checkpointBackfillJob(database, job, {
    complete: true,
    coveredInterval
  });
  emitCoverageChanged(options, coveredInterval);
}

function emitCoverageChanged(
  options: Pick<HistorySyncOptions, 'publishEvent'>,
  interval: {
    chatId: string;
    endAt: Date;
    startAt: Date;
  }
): void {
  emitHistoryEvent(options, 'history.coverage.changed', {
    chatId: interval.chatId,
    endAt: interval.endAt.toISOString(),
    startAt: interval.startAt.toISOString()
  });
}

async function discoverHistorySyncChats(
  database: AppDatabase,
  client: TelegramClient,
  loadBatchSize: number
): Promise<HistorySyncChat[]> {
  await loadAllChats(client, loadBatchSize);

  const chatIds = dedupeTelegramIds([
    ...(await getChatIds(client, 'main', 100000)),
    ...(await getChatIds(client, 'archive', 100000))
  ]);
  const chats: HistorySyncChat[] = [];

  for (const chatId of chatIds) {
    const chat = await getChatOrUndefined(client, chatId);
    const normalized = normalizeChat(chat);
    if (normalized === undefined) {
      continue;
    }

    await upsertChat(database, normalized);
    if (isHistorySyncChatType(normalized.type)) {
      chats.push({
        id: normalized.id,
        numericId: chatId,
        raw: normalized.raw,
        title: normalized.title,
        type: normalized.type
      });
    }
  }

  return chats;
}

async function listKnownHistorySyncChats(database: AppDatabase): Promise<HistorySyncChat[]> {
  const rows = await database
    .select({
      id: telegramChats.telegramChatId,
      raw: telegramChats.raw,
      title: telegramChats.title,
      type: telegramChats.type
    })
    .from(telegramChats)
    .orderBy(asc(telegramChats.telegramChatId));

  return rows
    .filter((row) => isHistorySyncChatType(row.type))
    .map((row) => ({
      id: row.id,
      raw: row.raw,
      title: row.title,
      type: row.type
    }));
}

async function getChatOrUndefined(
  client: TelegramClient,
  chatId: number
): Promise<TdObject | undefined> {
  try {
    return asTdObject(await invokeTdlib(client, { _: 'getChat', chat_id: chatId }));
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

async function getChatIds(
  client: TelegramClient,
  chatList: ChatListKind,
  limit: number
): Promise<number[]> {
  let chats: TdObject | undefined;
  try {
    chats = asTdObject(
      await invokeTdlib(client, {
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

async function loadAllChats(client: TelegramClient, batchSize: number): Promise<void> {
  await loadAllChatsFromList(client, 'main', batchSize);
  await loadAllChatsFromList(client, 'archive', batchSize);
}

async function loadAllChatsFromList(
  client: TelegramClient,
  chatList: ChatListKind,
  batchSize: number
): Promise<void> {
  for (;;) {
    try {
      await invokeTdlib(client, {
        _: 'loadChats',
        chat_list: toTdChatList(chatList),
        limit: batchSize
      });
    } catch (error) {
      if (isTdlibNotFound(error)) {
        return;
      }

      throw error;
    }
  }
}

async function getLastMessageNoLaterThan(
  client: TelegramClient,
  chatId: number,
  end: Date
): Promise<TdObject | undefined> {
  try {
    return asTdObject(
      await invokeTdlib(client, {
        _: 'getChatMessageByDate',
        chat_id: chatId,
        date: Math.floor((end.getTime() - 1) / 1000)
      })
    );
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

async function invokeTdlib(client: TelegramClient, request: TdObject): Promise<unknown> {
  for (;;) {
    try {
      return await client.invoke(request);
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

function normalizeHistorySyncOptions(options: HistorySyncOptions): HistorySyncOptions {
  return {
    chatLoadBatchSize: Math.max(1, options.chatLoadBatchSize),
    discoverChats: options.discoverChats ?? true,
    jobWindowDays: Math.max(1, options.jobWindowDays),
    messageLimit: Math.min(100, Math.max(1, options.messageLimit)),
    ...(options.publishEvent === undefined ? {} : { publishEvent: options.publishEvent }),
    requestDelayMs: Math.max(0, options.requestDelayMs)
  };
}

function emitHistoryEvent(
  options: Pick<HistorySyncOptions, 'publishEvent'>,
  type: string,
  data: JsonObject
): void {
  options.publishEvent?.(
    createIntegrationEvent({
      data,
      source: 'telegram.history-sync',
      type
    })
  );
}

function truncateToTelegramSecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

function toTdChatList(chatList: ChatListKind): TdObject {
  return chatList === 'main' ? { _: 'chatListMain' } : { _: 'chatListArchive' };
}

function isHistorySyncChatType(type: string): boolean {
  return type === 'private' || type === 'secret' || type === 'group' || type === 'channel';
}

function dedupeTelegramIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

function readCursorMessageId(cursor: unknown): number | undefined {
  const record =
    typeof cursor === 'object' && cursor !== null ? (cursor as Record<string, unknown>) : undefined;
  return typeof record?.messageId === 'number' ? record.messageId : undefined;
}

function tdMessageId(message: TdObject | undefined): number | undefined {
  return typeof message?.id === 'number' ? message.id : undefined;
}

function tdMessageDate(message: TdObject | undefined): Date | undefined {
  return typeof message?.date === 'number' && message.date > 0
    ? new Date(message.date * 1000)
    : undefined;
}

function isBeforeInterval(message: TdObject, startAt: Date): boolean {
  const messageDate = tdMessageDate(message);
  return messageDate !== undefined && messageDate < startAt;
}

function messageDateForId(messages: TdObject[], messageId: number): Date | undefined {
  return tdMessageDate(messages.find((message) => tdMessageId(message) === messageId));
}

function oldestMessageIdOlderThan(
  messages: TdObject[],
  cursorMessageId: number
): number | undefined {
  const ids = messages
    .map(tdMessageId)
    .filter((id): id is number => id !== undefined && id < cursorMessageId);

  return ids.length === 0 ? undefined : Math.min(...ids);
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

function isTdObject(value: TdObject | undefined): value is TdObject {
  return value !== undefined;
}

function isTelegramId(value: unknown): value is number {
  return typeof value === 'number';
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
