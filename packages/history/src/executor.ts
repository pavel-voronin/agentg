import type { HistoryDatabase as AppDatabase } from './database.js';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/events/envelope';
import type { JsonObject } from '@agentg/events/json';

import { TELEGRAM_HISTORY_PAST_BOUNDARY } from './constants.js';
import { materializeTemplatesForChat } from './materialization.js';
import { isOneShotHistoryTarget, projectSyncIntervalsForChat } from './reconciler.js';
import {
  deleteHistoryTarget,
  listHistoryTargets,
  listHistoryTemplates,
  upsertHistoryTargets
} from './store.js';
import type { TelegramHistoryClient } from './telegram-client.js';
import type { HistoryInterval, HistoryTarget, TelegramChatForHistory } from './types.js';

export type HistorySyncOptions = {
  chatLoadBatchSize: number;
  discoverChats?: boolean;
  messageLimit: number;
  publishEvent?: (event: IntegrationEvent) => void;
  requestDelayMs: number;
  syncWindowDays: number;
};

type SyncRequestResult = {
  coveredIntervals: number;
  fetchedMessages: number;
  pages: number;
  remainingIntervals: number;
  reachedBeginning: boolean;
  storedMessages: number;
};

export async function runHistorySync(
  database: AppDatabase,
  client: TelegramHistoryClient,
  options: HistorySyncOptions
): Promise<void> {
  const safeOptions = normalizeHistorySyncOptions(options);
  const syncNow = truncateToTelegramSecond(new Date());
  emitHistoryEvent(safeOptions, 'history.sync.started', {
    now: syncNow.toISOString()
  });

  const chats = await client.listChats({
    discover: safeOptions.discoverChats === true,
    loadBatchSize: safeOptions.chatLoadBatchSize
  });
  const targets = await materializeHistoryTargets(database, chats, safeOptions);
  const result = await requestTelegramCoverageForTargets(
    client,
    database,
    targets,
    syncNow,
    safeOptions
  );

  emitHistoryEvent(safeOptions, 'history.sync.completed', {
    chats: chats.length,
    coveredIntervals: result.coveredIntervals,
    fetchedMessages: result.fetchedMessages,
    pages: result.pages,
    remainingIntervals: result.remainingIntervals,
    storedMessages: result.storedMessages,
    targets: targets.length
  });
}

async function materializeHistoryTargets(
  database: AppDatabase,
  chats: TelegramChatForHistory[],
  options: HistorySyncOptions
): Promise<HistoryTarget[]> {
  const templates = await listHistoryTemplates(database);
  const chatIds = new Set(chats.map((chat) => chat.id));
  let targets = await deleteTargetsForUnlistedChats(
    database,
    await listHistoryTargets(database),
    chatIds,
    options
  );
  for (const chat of chats) {
    targets = materializeTemplatesForChat(templates, chat, targets);
  }

  await upsertHistoryTargets(database, targets);
  return targets;
}

async function deleteTargetsForUnlistedChats(
  database: AppDatabase,
  targets: HistoryTarget[],
  chatIds: Set<string>,
  options: HistorySyncOptions
): Promise<HistoryTarget[]> {
  const activeTargets: HistoryTarget[] = [];
  for (const target of targets) {
    if (chatIds.has(target.chatId)) {
      activeTargets.push(target);
      continue;
    }
    const deleted = await deleteHistoryTarget(database, target.id);
    if (deleted !== undefined) {
      emitHistoryEvent(options, 'history.target.auto_deleted', {
        chatId: target.chatId,
        targetId: target.id
      });
    }
  }
  return activeTargets;
}

async function requestTelegramCoverageForTargets(
  client: TelegramHistoryClient,
  database: AppDatabase,
  targets: HistoryTarget[],
  now: Date,
  options: HistorySyncOptions
): Promise<SyncRequestResult> {
  const chatIds = [...new Set(targets.map((target) => target.chatId))].sort();
  const result: SyncRequestResult = {
    coveredIntervals: 0,
    fetchedMessages: 0,
    pages: 0,
    remainingIntervals: 0,
    reachedBeginning: false,
    storedMessages: 0
  };

  for (const chatId of chatIds) {
    const intervals = projectSyncIntervalsForChat({
      chatId,
      literals: {
        past: TELEGRAM_HISTORY_PAST_BOUNDARY
      },
      now,
      syncWindowMilliseconds: options.syncWindowDays * 24 * 60 * 60 * 1000,
      targets
    });

    for (const interval of intervals.slice(0, 1)) {
      const syncResult = await requestTelegramCoverage(client, chatId, interval, options);
      result.coveredIntervals += syncResult.coveredIntervals.length;
      result.fetchedMessages += syncResult.fetchedMessages;
      result.pages += syncResult.pages;
      result.remainingIntervals += syncResult.remainingIntervals.length;
      result.reachedBeginning ||= syncResult.reachedBeginning;
      result.storedMessages += syncResult.storedMessages;
    }

    await deleteCompletedOneShotTargets(database, client, targets, chatId, now, options);
  }

  console.log(
    JSON.stringify({
      event: 'history.sync_pass_complete',
      ...result
    })
  );

  return result;
}

async function requestTelegramCoverage(
  client: TelegramHistoryClient,
  chatId: string,
  interval: HistoryInterval,
  options: Pick<HistorySyncOptions, 'messageLimit' | 'requestDelayMs'>
) {
  return client.ensureHistoryCoverage({
    chatId,
    endAt: interval.endAt.toISOString(),
    limit: options.messageLimit,
    maxPages: 1,
    requestDelayMs: options.requestDelayMs,
    startAt: interval.startAt.toISOString()
  });
}

async function deleteCompletedOneShotTargets(
  database: AppDatabase,
  client: TelegramHistoryClient,
  targets: HistoryTarget[],
  chatId: string,
  now: Date,
  options: Pick<HistorySyncOptions, 'publishEvent'>
): Promise<void> {
  for (const target of targets.filter((candidate) => candidate.chatId === chatId)) {
    if (!isOneShotHistoryTarget(target)) {
      continue;
    }

    const projected = projectSyncIntervalsForChat({
      chatId,
      literals: {
        past: TELEGRAM_HISTORY_PAST_BOUNDARY
      },
      now,
      targets: [target]
    })[0];
    if (projected === undefined) {
      continue;
    }

    const coverage = await client.getHistoryCoverage({ chatId });
    const targetCovered = coverage.coverage.some((interval) => {
      const startAt = new Date(interval.startAt);
      const endAt = new Date(interval.endAt);
      return startAt <= projected.startAt && endAt >= projected.endAt;
    });
    if (!targetCovered) {
      continue;
    }

    const deleted = await deleteHistoryTarget(database, target.id);
    if (deleted !== undefined) {
      emitHistoryEvent(options, 'history.target.auto_deleted', {
        chatId: target.chatId,
        targetId: target.id
      });
    }
  }
}

function normalizeHistorySyncOptions(options: HistorySyncOptions): HistorySyncOptions {
  return {
    chatLoadBatchSize: Math.max(1, options.chatLoadBatchSize),
    discoverChats: options.discoverChats ?? true,
    messageLimit: Math.min(100, Math.max(1, options.messageLimit)),
    ...(options.publishEvent === undefined ? {} : { publishEvent: options.publishEvent }),
    requestDelayMs: Math.max(0, options.requestDelayMs),
    syncWindowDays: Math.max(1, options.syncWindowDays)
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
      type
    })
  );
}

function truncateToTelegramSecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}
