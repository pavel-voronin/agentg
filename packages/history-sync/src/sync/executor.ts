import {
  incrementTelemetryCounter,
  setTelemetryGauge,
  timeTelemetrySpan,
  type EventBus,
  type TelemetryAttributes
} from '@agentg/framework';

import type { Database } from '../database/client.js';
import type {
  HistorySyncInterval,
  HistorySyncTarget,
  TelegramHistoryClient
} from '../model/types.js';
import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../range/constants.js';
import { floorToTelegramSecond } from '../range/time.js';
import { materializeTemplatesForChat } from '../target/materialization.js';
import { isOneShotHistorySyncTarget, projectSyncIntervalsForChat } from './reconciler.js';
import {
  deleteHistorySyncTarget,
  listHistorySyncTargets,
  listHistorySyncTemplates,
  upsertHistorySyncTargets
} from '../target/store.js';

export type SyncOptions = {
  chatLoadBatchSize: number;
  discoverChats?: boolean | undefined;
  messageLimit: number;
  requestDelayMs: number;
  windowDays: number;
};

type SyncResult = {
  coveredIntervals: number;
  fetchedMessages: number;
  pages: number;
  remainingIntervals: number;
  reachedBeginning: boolean;
  storedMessages: number;
};

const METRIC_SYNC_STAGE_DURATION = 'history_sync.sync.stage.duration';
const METRIC_SYNC_LAST_COMPLETED_SECONDS = 'history_sync.sync.last_completed.unix_seconds';
const METRIC_SYNC_LAST_CHATS = 'history_sync.sync.last_chats';
const METRIC_SYNC_LAST_TARGETS = 'history_sync.sync.last_targets';
const METRIC_SYNC_LAST_PAGES = 'history_sync.sync.last_pages';
const METRIC_SYNC_LAST_FETCHED_MESSAGES = 'history_sync.sync.last_fetched_messages';
const METRIC_SYNC_LAST_STORED_MESSAGES = 'history_sync.sync.last_stored_messages';
const METRIC_SYNC_LAST_COVERED_INTERVALS = 'history_sync.sync.last_covered_intervals';
const METRIC_SYNC_LAST_REMAINING_INTERVALS = 'history_sync.sync.last_remaining_intervals';
const METRIC_SYNC_PAGES = 'history_sync.sync.pages';
const METRIC_SYNC_FETCHED_MESSAGES = 'history_sync.sync.messages.fetched';
const METRIC_SYNC_STORED_MESSAGES = 'history_sync.sync.messages.stored';
const METRIC_SYNC_COVERED_INTERVALS = 'history_sync.sync.covered_intervals';

export async function runHistorySync(
  database: Database,
  telegram: TelegramHistoryClient,
  events: EventBus,
  options: SyncOptions
): Promise<void> {
  const safeOptions = normalizeSyncOptions(options);
  const syncNow = floorToTelegramSecond(new Date());
  events.publish('history-sync.sync.started', {
    now: syncNow.toISOString()
  });

  const chats = await timeSyncStage(
    'list_chats',
    {
      'history_sync.chat.load_batch_size': safeOptions.chatLoadBatchSize,
      'history_sync.discovery.enabled': safeOptions.discoverChats === true
    },
    () =>
      telegram.listChats({
        discover: safeOptions.discoverChats === true,
        loadBatchSize: safeOptions.chatLoadBatchSize
      })
  );
  const targets = await timeSyncStage('materialize_targets', {}, () =>
    materializeHistorySyncTargets(database, chats, events)
  );
  const result = await timeSyncStage(
    'request_coverage',
    {
      'history_sync.chat.count': chats.length,
      'history_sync.sync.window_days': safeOptions.windowDays,
      'history_sync.target.count': targets.length
    },
    () => requestCoverageForTargets(database, telegram, events, targets, syncNow, safeOptions)
  );
  recordSyncResult(syncNow, chats.length, targets.length, result);

  events.publish('history-sync.sync.completed', {
    chats: chats.length,
    coveredIntervals: result.coveredIntervals,
    fetchedMessages: result.fetchedMessages,
    pages: result.pages,
    remainingIntervals: result.remainingIntervals,
    storedMessages: result.storedMessages,
    targets: targets.length
  });
}

async function materializeHistorySyncTargets(
  database: Database,
  chats: Awaited<ReturnType<TelegramHistoryClient['listChats']>>,
  events: EventBus
): Promise<HistorySyncTarget[]> {
  const templates = await listHistorySyncTemplates(database);
  const chatIds = new Set(chats.map((chat) => chat.id));
  let targets = await deleteTargetsForUnlistedChats(
    database,
    events,
    await listHistorySyncTargets(database),
    chatIds
  );
  for (const chat of chats) {
    targets = materializeTemplatesForChat(templates, chat, targets);
  }

  await upsertHistorySyncTargets(database, targets);
  return targets;
}

async function deleteTargetsForUnlistedChats(
  database: Database,
  events: EventBus,
  targets: HistorySyncTarget[],
  chatIds: Set<string>
): Promise<HistorySyncTarget[]> {
  const activeTargets: HistorySyncTarget[] = [];
  for (const target of targets) {
    if (chatIds.has(target.chatId)) {
      activeTargets.push(target);
      continue;
    }

    const deleted = await deleteHistorySyncTarget(database, target.id);
    if (deleted !== undefined) {
      events.publish('history-sync.target.auto_deleted', {
        chatId: target.chatId,
        targetId: target.id
      });
    }
  }
  return activeTargets;
}

async function requestCoverageForTargets(
  database: Database,
  telegram: TelegramHistoryClient,
  events: EventBus,
  targets: HistorySyncTarget[],
  now: Date,
  options: SyncOptions
): Promise<SyncResult> {
  const chatIds = [...new Set(targets.map((target) => target.chatId))].sort();
  const result: SyncResult = {
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
      syncWindowMilliseconds: options.windowDays * 24 * 60 * 60 * 1000,
      targets
    });

    for (const interval of intervals.slice(0, 1)) {
      const sync = await timeSyncStage('request_interval', {}, () =>
        requestTelegramCoverage(telegram, chatId, interval, options)
      );
      result.coveredIntervals += sync.coveredIntervals.length;
      result.fetchedMessages += sync.fetchedMessages;
      result.pages += sync.pages;
      result.remainingIntervals += sync.remainingIntervals.length;
      result.reachedBeginning ||= sync.reachedBeginning;
      result.storedMessages += sync.storedMessages;
    }

    const oneShotTargets = targets.filter(
      (target) => target.chatId === chatId && isOneShotHistorySyncTarget(target)
    );
    if (oneShotTargets.length > 0) {
      await timeSyncStage(
        'cleanup_one_shot_targets',
        {
          'history_sync.target.count': oneShotTargets.length
        },
        () => deleteCompletedOneShotTargets(database, telegram, events, oneShotTargets, chatId, now)
      );
    }
  }

  return result;
}

function requestTelegramCoverage(
  telegram: TelegramHistoryClient,
  chatId: string,
  interval: HistorySyncInterval,
  options: Pick<SyncOptions, 'messageLimit' | 'requestDelayMs'>
) {
  return telegram.ensureHistoryCoverage({
    chatId,
    endAt: interval.endAt.toISOString(),
    limit: options.messageLimit,
    maxPages: 1,
    requestDelayMs: options.requestDelayMs,
    startAt: interval.startAt.toISOString()
  });
}

async function deleteCompletedOneShotTargets(
  database: Database,
  telegram: TelegramHistoryClient,
  events: EventBus,
  oneShotTargets: HistorySyncTarget[],
  chatId: string,
  now: Date
): Promise<void> {
  for (const target of oneShotTargets) {
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

    const coverage = await telegram.getHistoryCoverage({ chatId });
    const targetCovered = coverage.coverage.some((interval) => {
      const startAt = new Date(interval.startAt);
      const endAt = new Date(interval.endAt);
      return startAt <= projected.startAt && endAt >= projected.endAt;
    });
    if (!targetCovered) {
      continue;
    }

    const deleted = await deleteHistorySyncTarget(database, target.id);
    if (deleted !== undefined) {
      events.publish('history-sync.target.auto_deleted', {
        chatId: target.chatId,
        targetId: target.id
      });
    }
  }
}

function normalizeSyncOptions(options: SyncOptions): SyncOptions {
  return {
    chatLoadBatchSize: Math.max(1, options.chatLoadBatchSize),
    discoverChats: options.discoverChats ?? true,
    messageLimit: Math.min(100, Math.max(1, options.messageLimit)),
    requestDelayMs: Math.max(0, options.requestDelayMs),
    windowDays: Math.max(1, options.windowDays)
  };
}

function timeSyncStage<T>(
  stage: string,
  attributes: TelemetryAttributes,
  operation: () => Promise<T>
): Promise<T> {
  const stageAttributes = {
    ...attributes,
    'history_sync.sync.stage': stage
  };
  return timeTelemetrySpan(
    {
      attributes: stageAttributes,
      metric: {
        attributes: {
          'history_sync.sync.stage': stage
        },
        name: METRIC_SYNC_STAGE_DURATION
      },
      name: `history_sync.sync.${stage}`
    },
    operation
  );
}

function recordSyncResult(
  completedAt: Date,
  chats: number,
  targets: number,
  result: SyncResult
): void {
  setTelemetryGauge(METRIC_SYNC_LAST_COMPLETED_SECONDS, completedAt.getTime() / 1000);
  setTelemetryGauge(METRIC_SYNC_LAST_CHATS, chats);
  setTelemetryGauge(METRIC_SYNC_LAST_TARGETS, targets);
  setTelemetryGauge(METRIC_SYNC_LAST_PAGES, result.pages);
  setTelemetryGauge(METRIC_SYNC_LAST_FETCHED_MESSAGES, result.fetchedMessages);
  setTelemetryGauge(METRIC_SYNC_LAST_STORED_MESSAGES, result.storedMessages);
  setTelemetryGauge(METRIC_SYNC_LAST_COVERED_INTERVALS, result.coveredIntervals);
  setTelemetryGauge(METRIC_SYNC_LAST_REMAINING_INTERVALS, result.remainingIntervals);
  incrementTelemetryCounter(METRIC_SYNC_PAGES, result.pages);
  incrementTelemetryCounter(METRIC_SYNC_FETCHED_MESSAGES, result.fetchedMessages);
  incrementTelemetryCounter(METRIC_SYNC_STORED_MESSAGES, result.storedMessages);
  incrementTelemetryCounter(METRIC_SYNC_COVERED_INTERVALS, result.coveredIntervals);
}
