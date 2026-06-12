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
  HistorySyncTemplate,
  TelegramChatForHistorySync,
  TelegramHistoryClient
} from '../model/types.js';
import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../range/constants.js';
import { sameHistorySyncRange } from '../range/ranges.js';
import { floorToTelegramSecond } from '../range/time.js';
import { materializeTemplatesForChat } from '../target/materialization.js';
import { isOneShotHistorySyncTarget, projectSyncIntervalsForChat } from './reconciler.js';
import {
  deleteHistorySyncTarget,
  isRelativeHistorySyncTarget,
  listHistorySyncTargets,
  listHistorySyncTemplates,
  upsertHistorySyncTargets
} from '../target/store.js';

export type SyncTargetScope = 'all' | 'relative' | 'relative_and_selected' | 'selected';

export type SyncOptions = {
  chatLoadBatchSize: number;
  messageLimit: number;
  requestDelayMs: number;
  windowDays: number;
};

export type SyncRunRequest = {
  discoveredChatIds: ReadonlySet<string>;
  discoverChats: boolean;
  fullReconcile: boolean;
  reason: string;
  targetScope: SyncTargetScope;
  targetChatIds?: ReadonlySet<string> | undefined;
};

type DemandSnapshot = {
  targets: HistorySyncTarget[];
  templates: HistorySyncTemplate[];
};

type MaterializationResult = {
  chatCount: number;
  targets: HistorySyncTarget[];
};

type SyncResult = {
  coveredIntervals: number;
  deletedTargetIds: string[];
  fetchedMessages: number;
  pages: number;
  remainingIntervals: number;
  reachedBeginning: boolean;
  storedMessages: number;
};

type SyncRunSummary = {
  targets: HistorySyncTarget[];
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
const METRIC_SYNC_LAST_SKIPPED_SECONDS = 'history_sync.sync.last_skipped.unix_seconds';
const METRIC_SYNC_PAGES = 'history_sync.sync.pages';
const METRIC_SYNC_FETCHED_MESSAGES = 'history_sync.sync.messages.fetched';
const METRIC_SYNC_STORED_MESSAGES = 'history_sync.sync.messages.stored';
const METRIC_SYNC_COVERED_INTERVALS = 'history_sync.sync.covered_intervals';
const METRIC_SYNC_SKIPPED = 'history_sync.sync.skipped';

export async function runHistorySync(
  database: Database,
  telegram: TelegramHistoryClient,
  events: EventBus,
  request: SyncRunRequest,
  options: SyncOptions
): Promise<SyncRunSummary> {
  const safeOptions = normalizeSyncOptions(options);
  const syncNow = floorToTelegramSecond(new Date());
  const mode = syncMode(request);
  events.publish('history-sync.sync.started', {
    mode,
    now: syncNow.toISOString(),
    reason: request.reason
  });

  const demand = await timeSyncStage(
    'load_demand',
    {
      'history_sync.sync.mode': mode
    },
    () => loadDemand(database)
  );
  if (demand.targets.length === 0 && demand.templates.length === 0) {
    recordSyncSkipped(syncNow, mode, 'no_demand');
    events.publish('history-sync.sync.skipped', {
      mode,
      reason: request.reason,
      skipReason: 'no_demand',
      targets: 0,
      templates: 0
    });
    return {
      targets: []
    };
  }

  const materialized = await materializeTargetsForRequest(
    database,
    telegram,
    events,
    request,
    demand,
    safeOptions
  );
  const targets = targetsForCoverage(materialized.targets, request);
  const result =
    targets.length === 0
      ? emptySyncResult()
      : await timeSyncStage(
          'request_coverage',
          {
            'history_sync.chat.count': uniqueChatCount(targets),
            'history_sync.sync.mode': mode,
            'history_sync.sync.window_days': safeOptions.windowDays,
            'history_sync.target.count': targets.length
          },
          () => requestCoverageForTargets(database, telegram, events, targets, syncNow, safeOptions)
        );
  const coveredChatCount = uniqueChatCount(targets);
  const activeTargets = targetsAfterCleanup(materialized.targets, result.deletedTargetIds);
  recordSyncResult(syncNow, coveredChatCount, targets.length, result);

  events.publish('history-sync.sync.completed', {
    chats: coveredChatCount,
    coveredIntervals: result.coveredIntervals,
    fetchedMessages: result.fetchedMessages,
    mode,
    pages: result.pages,
    reason: request.reason,
    remainingIntervals: result.remainingIntervals,
    storedMessages: result.storedMessages,
    targets: targets.length
  });

  return {
    targets: activeTargets
  };
}

async function loadDemand(database: Database): Promise<DemandSnapshot> {
  const [templates, targets] = await Promise.all([
    listHistorySyncTemplates(database),
    listHistorySyncTargets(database)
  ]);

  return {
    targets,
    templates
  };
}

async function materializeTargetsForRequest(
  database: Database,
  telegram: TelegramHistoryClient,
  events: EventBus,
  request: SyncRunRequest,
  demand: DemandSnapshot,
  options: SyncOptions
): Promise<MaterializationResult> {
  if (request.fullReconcile) {
    const chats = await timeSyncStage(
      'list_chats',
      {
        'history_sync.chat.load_batch_size': options.chatLoadBatchSize,
        'history_sync.discovery.enabled': request.discoverChats,
        'history_sync.sync.mode': syncMode(request)
      },
      () =>
        telegram.listChats({
          discover: request.discoverChats,
          loadBatchSize: options.chatLoadBatchSize
        })
    );
    const targets = await timeSyncStage(
      'materialize_targets',
      {
        'history_sync.chat.count': chats.length,
        'history_sync.template.count': demand.templates.length
      },
      () => materializeAllTargets(database, events, demand.templates, demand.targets, chats)
    );

    return {
      chatCount: chats.length,
      targets
    };
  }

  if (request.discoveredChatIds.size === 0 || demand.templates.length === 0) {
    return {
      chatCount: 0,
      targets: demand.targets
    };
  }

  const chats = await timeSyncStage(
    'load_discovered_chats',
    {
      'history_sync.chat.requested_count': request.discoveredChatIds.size,
      'history_sync.sync.mode': syncMode(request)
    },
    () => listDiscoveredHistoryChats(telegram, request.discoveredChatIds)
  );
  const targets = await timeSyncStage(
    'materialize_targets',
    {
      'history_sync.chat.count': chats.length,
      'history_sync.template.count': demand.templates.length
    },
    () => materializeChats(database, demand.templates, demand.targets, chats)
  );

  return {
    chatCount: chats.length,
    targets
  };
}

async function materializeAllTargets(
  database: Database,
  events: EventBus,
  templates: HistorySyncTemplate[],
  targets: HistorySyncTarget[],
  chats: TelegramChatForHistorySync[]
): Promise<HistorySyncTarget[]> {
  const activeTargets = await deleteTargetsForUnlistedChats(
    database,
    events,
    targets,
    new Set(chats.map((chat) => chat.id))
  );

  return materializeChats(database, templates, activeTargets, chats);
}

async function materializeChats(
  database: Database,
  templates: HistorySyncTemplate[],
  targets: HistorySyncTarget[],
  chats: TelegramChatForHistorySync[]
): Promise<HistorySyncTarget[]> {
  let nextTargets = targets;
  const changedTargets = new Map<string, HistorySyncTarget>();
  for (const chat of chats) {
    const previousTargets = nextTargets;
    nextTargets = materializeTemplatesForChat(templates, chat, nextTargets);
    for (const target of changedTargetsForChat(previousTargets, nextTargets, chat.id)) {
      changedTargets.set(target.id, target);
    }
  }

  await upsertHistorySyncTargets(database, [...changedTargets.values()]);
  return nextTargets;
}

function changedTargetsForChat(
  previousTargets: HistorySyncTarget[],
  nextTargets: HistorySyncTarget[],
  chatId: string
): HistorySyncTarget[] {
  const previousTargetsById = new Map(previousTargets.map((target) => [target.id, target]));
  return nextTargets.filter((target) => {
    if (target.chatId !== chatId) {
      return false;
    }

    return !sameHistorySyncTarget(previousTargetsById.get(target.id), target);
  });
}

function sameHistorySyncTarget(
  previous: HistorySyncTarget | undefined,
  next: HistorySyncTarget
): boolean {
  return (
    previous?.chatId === next.chatId &&
    previous.templateId === next.templateId &&
    sameHistorySyncRange(previous.range, next.range)
  );
}

async function listDiscoveredHistoryChats(
  telegram: TelegramHistoryClient,
  chatIds: ReadonlySet<string>
): Promise<TelegramChatForHistorySync[]> {
  const chats: TelegramChatForHistorySync[] = [];
  for (const chatId of [...chatIds].sort()) {
    const facts = await telegram.getChatHistoryFacts({ chatId });
    const chat = facts.chat;
    if (chat === null || !isHistorySyncChatType(chat.type)) {
      continue;
    }

    chats.push({
      id: chat.id,
      title: chat.title,
      type: chat.type
    });
  }
  return chats;
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
  const result = emptySyncResult();

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
      const deletedTargetIds = await timeSyncStage(
        'cleanup_one_shot_targets',
        {
          'history_sync.target.count': oneShotTargets.length
        },
        () => deleteCompletedOneShotTargets(database, telegram, events, oneShotTargets, chatId, now)
      );
      result.deletedTargetIds.push(...deletedTargetIds);
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
): Promise<string[]> {
  const deletedTargetIds: string[] = [];
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
      deletedTargetIds.push(deleted.id);
      events.publish('history-sync.target.auto_deleted', {
        chatId: target.chatId,
        targetId: target.id
      });
    }
  }
  return deletedTargetIds;
}

function targetsForCoverage(
  targets: HistorySyncTarget[],
  request: SyncRunRequest
): HistorySyncTarget[] {
  if (request.fullReconcile || request.targetScope === 'all') {
    return targets;
  }

  const chatIds = new Set([...(request.targetChatIds ?? []), ...request.discoveredChatIds]);
  return targets.filter((target) => {
    if (includesRelativeTargets(request.targetScope) && isRelativeHistorySyncTarget(target)) {
      return true;
    }

    return includesSelectedTargets(request.targetScope) && chatIds.has(target.chatId);
  });
}

function normalizeSyncOptions(options: SyncOptions): SyncOptions {
  return {
    chatLoadBatchSize: Math.max(1, options.chatLoadBatchSize),
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

function recordSyncSkipped(completedAt: Date, mode: string, skipReason: string): void {
  setTelemetryGauge(METRIC_SYNC_LAST_SKIPPED_SECONDS, completedAt.getTime() / 1000);
  incrementTelemetryCounter(METRIC_SYNC_SKIPPED, 1, {
    'history_sync.skip_reason': skipReason,
    'history_sync.sync.mode': mode
  });
}

function emptySyncResult(): SyncResult {
  return {
    coveredIntervals: 0,
    deletedTargetIds: [],
    fetchedMessages: 0,
    pages: 0,
    remainingIntervals: 0,
    reachedBeginning: false,
    storedMessages: 0
  };
}

function targetsAfterCleanup(
  targets: HistorySyncTarget[],
  deletedTargetIds: readonly string[]
): HistorySyncTarget[] {
  if (deletedTargetIds.length === 0) {
    return targets;
  }
  const deleted = new Set(deletedTargetIds);
  return targets.filter((target) => !deleted.has(target.id));
}

function syncMode(request: SyncRunRequest): string {
  if (request.fullReconcile) {
    return request.discoverChats ? 'startup_full' : 'full_reconcile';
  }
  if (request.discoveredChatIds.size > 0) {
    return 'chat_discovered';
  }
  if (request.targetScope === 'relative') {
    return 'target_relative';
  }
  if (request.targetScope === 'all') {
    return 'target_all';
  }
  if (request.targetScope === 'relative_and_selected') {
    return 'target_mixed';
  }
  return 'target_selected';
}

function uniqueChatCount(targets: HistorySyncTarget[]): number {
  return new Set(targets.map((target) => target.chatId)).size;
}

function isHistorySyncChatType(type: string): boolean {
  return type === 'private' || type === 'secret' || type === 'group' || type === 'channel';
}

function includesRelativeTargets(scope: SyncTargetScope): boolean {
  return scope === 'relative' || scope === 'relative_and_selected';
}

function includesSelectedTargets(scope: SyncTargetScope): boolean {
  return scope === 'selected' || scope === 'relative_and_selected';
}
