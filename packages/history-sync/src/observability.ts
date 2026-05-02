import type { HistoryDatabase as AppDatabase } from './database.js';
import {
  historyBackfillJobs,
  historyCoverage,
  historyTargets,
  historyTemplates
} from './schema.js';
import type { EventBus } from '@agentg/shared/events/bus';
import { createIntegrationEvent } from '@agentg/shared/events/envelope';
import type { JsonObject } from '@agentg/shared/json';
import type { TelegramChatDirectoryEntry, TelegramChatFolder } from '@agentg/telegram/rpc';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { TELEGRAM_HISTORY_PAST_BOUNDARY } from './constants.js';
import {
  canonicalizeHistoryRange,
  projectHistoryRange,
  subtractIntervals,
  type HistoryRangeProjectionContext
} from './ranges.js';
import { normalizeCoverageIntervals } from './coverage.js';
import { projectTargetsForChat } from './reconciler.js';
import { floorToTelegramSecond, normalizeTelegramHistoryInterval } from './time.js';
import {
  deleteManualHistoryTargetFromCommand,
  upsertManualHistoryTargetFromCommand
} from './target-commands.js';
import type {
  HistoryCoverageInterval,
  HistoryInterval,
  HistoryRange,
  HistoryTarget
} from './types.js';
import type { TelegramReadClient } from './telegram-client.js';

type HistoryTargetResponse = {
  chatId: string;
  id: string;
  projected: {
    endAt: string;
    startAt: string;
  };
  range: HistoryRange;
  templateId: string | null;
};

type TelegramChatSortKey = {
  id: string;
  lastMessageDate: number;
  listRank: number;
  order: bigint;
  title: string;
};

type ChatListFilter =
  | {
      kind: 'archive';
    }
  | {
      kind: 'main';
    }
  | {
      folderId: number;
      kind: 'folder';
    };

export type HistoryRuntime = {
  database: AppDatabase;
  eventBus: EventBus;
  requestSync?: (reason: string, chatId?: string) => void;
  telegram?: TelegramReadClient;
};

const activeBackfillJobStatuses = ['pending', 'running'];

export async function callHistoryMethod(
  runtime: HistoryRuntime,
  method: string,
  params: unknown
): Promise<unknown> {
  if (method === 'history.getOverview') {
    return getHistoryOverview(runtime);
  }

  if (method === 'history.listChats') {
    return listHistoryChats(runtime, params);
  }

  if (method === 'history.getChatHistoryState') {
    return getChatHistoryState(runtime, params);
  }

  if (method === 'history.upsertTarget') {
    return upsertHistoryTarget(runtime, params);
  }

  if (method === 'history.deleteTarget') {
    return deleteHistoryTarget(runtime, params);
  }

  if (method === 'history.requestSync') {
    return requestHistorySyncFromRpc(runtime, params);
  }

  if (method === 'history.listJobs') {
    return listHistoryJobs(runtime.database, params);
  }

  return undefined;
}

async function getHistoryOverview(runtime: HistoryRuntime): Promise<unknown> {
  const telegram = requireTelegramReadClient(runtime);
  const [directory, templates, targets, coverage, activeJobs] = await Promise.all([
    telegram.listChatDirectory({}),
    runtime.database.select({ id: historyTemplates.id }).from(historyTemplates),
    runtime.database.select({ id: historyTargets.id }).from(historyTargets),
    runtime.database.select({ id: historyCoverage.id }).from(historyCoverage),
    runtime.database
      .select({
        endAt: historyBackfillJobs.endAt,
        startAt: historyBackfillJobs.startAt,
        status: historyBackfillJobs.status,
        telegramChatId: historyBackfillJobs.telegramChatId
      })
      .from(historyBackfillJobs)
      .where(inArray(historyBackfillJobs.status, activeBackfillJobStatuses))
      .orderBy(
        desc(historyBackfillJobs.status),
        desc(historyBackfillJobs.endAt),
        desc(historyBackfillJobs.startAt)
      )
      .limit(1)
  ]);
  const jobs = await runtime.database
    .select({
      status: historyBackfillJobs.status
    })
    .from(historyBackfillJobs)
    .where(inArray(historyBackfillJobs.status, activeBackfillJobStatuses));
  const jobCounts = countBy(jobs, (job) => job.status);
  const activeJob = activeJobs[0];

  return {
    activeJob:
      activeJob === undefined
        ? null
        : {
            chatId: activeJob.telegramChatId,
            endAt: activeJob.endAt.toISOString(),
            startAt: activeJob.startAt.toISOString(),
            status: activeJob.status
          },
    chats: directory.chats.length,
    coverageIntervals: coverage.length,
    pendingJobs: jobCounts.pending ?? 0,
    runningJobs: jobCounts.running ?? 0,
    targets: targets.length,
    templates: templates.length
  };
}

async function listHistoryChats(runtime: HistoryRuntime, params: unknown): Promise<unknown> {
  const telegram = requireTelegramReadClient(runtime);
  const input = asRecord(params);
  const query = asString(input?.query)?.trim();
  const type = asString(input?.type)?.trim();
  const limit = parseLimit(input?.limit, 100, 500);
  const listFilter =
    query === undefined || query.length === 0 ? chatListFilterFromInput(input) : undefined;

  const directory = await telegram.listChatDirectory({
    ...(query === undefined || query.length === 0 ? {} : { query }),
    ...(type === undefined || type.length === 0 ? {} : { type })
  });
  const chats = directory.chats
    .filter((chat) => (listFilter === undefined ? true : chatMatchesListFilter(chat, listFilter)))
    .sort((left, right) => compareTelegramChatsByTdlibOrder(left, right, listFilter))
    .slice(0, limit);
  const chatIds = chats.map((chat) => chat.id);
  const [targets, coverage, jobs] =
    chatIds.length === 0
      ? [[], [], []]
      : await Promise.all([
          runtime.database
            .select({
              telegramChatId: historyTargets.telegramChatId
            })
            .from(historyTargets)
            .where(inArray(historyTargets.telegramChatId, chatIds)),
          runtime.database
            .select({
              endAt: historyCoverage.endAt,
              startAt: historyCoverage.startAt,
              telegramChatId: historyCoverage.telegramChatId
            })
            .from(historyCoverage)
            .where(inArray(historyCoverage.telegramChatId, chatIds)),
          runtime.database
            .select({
              status: historyBackfillJobs.status,
              telegramChatId: historyBackfillJobs.telegramChatId
            })
            .from(historyBackfillJobs)
            .where(
              and(
                inArray(historyBackfillJobs.telegramChatId, chatIds),
                inArray(historyBackfillJobs.status, activeBackfillJobStatuses)
              )
            )
        ]);

  const targetsByChat = countBy(targets, (target) => target.telegramChatId);
  const jobsByChat = groupBy(jobs, (job) => job.telegramChatId);
  const coverageByChat = groupBy(coverage, (interval) => interval.telegramChatId);

  return {
    chats: chats.map((chat) => {
      const chatCoverage = coverageByChat.get(chat.id) ?? [];
      const chatJobs = jobsByChat.get(chat.id) ?? [];
      const jobCounts = countBy(chatJobs, (job) => job.status);

      return {
        coverageIntervals: chatCoverage.length,
        coverageNewestAt: maxOptionalDate(chatCoverage.map((interval) => interval.endAt)),
        coverageOldestAt: minOptionalDate(chatCoverage.map((interval) => interval.startAt)),
        id: chat.id,
        isBot: chat.isBot,
        pendingJobs: jobCounts.pending ?? 0,
        runningJobs: jobCounts.running ?? 0,
        targets: targetsByChat[chat.id] ?? 0,
        title: chat.title,
        type: chat.type,
        updatedAt: chat.updatedAt
      };
    }),
    navigation: historyChatNavigation(directory.navigationChats, directory.folders),
    types: directory.types
  };
}

async function getChatHistoryState(runtime: HistoryRuntime, params: unknown): Promise<unknown> {
  const telegram = requireTelegramReadClient(runtime);
  const input = asRecord(params);
  const chatId = requireString(input?.chatId, 'history.getChatHistoryState requires chatId');
  const facts = await telegram.getChatHistoryFacts({ chatId });
  const chat = facts.chat;
  if (chat === null) {
    return {
      chat: null,
      coverage: [],
      desired: [],
      jobs: [],
      missing: [],
      targets: []
    };
  }

  const [targetRows, coverageRows, jobRows] = await Promise.all([
    runtime.database
      .select()
      .from(historyTargets)
      .where(eq(historyTargets.telegramChatId, chatId))
      .orderBy(asc(historyTargets.id)),
    runtime.database
      .select()
      .from(historyCoverage)
      .where(eq(historyCoverage.telegramChatId, chatId))
      .orderBy(asc(historyCoverage.startAt)),
    runtime.database
      .select()
      .from(historyBackfillJobs)
      .where(
        and(
          eq(historyBackfillJobs.telegramChatId, chatId),
          inArray(historyBackfillJobs.status, activeBackfillJobStatuses)
        )
      )
      .orderBy(desc(historyBackfillJobs.endAt), desc(historyBackfillJobs.startAt))
      .limit(200)
  ]);

  const targetModels = targetRows.map(toHistoryTarget);
  const now = floorToTelegramSecond(new Date());
  const projectionContext = {
    literals: {
      past: TELEGRAM_HISTORY_PAST_BOUNDARY
    },
    now
  };
  const targets = targetRows.map((row) => toTargetResponse(row, projectionContext));
  const desired = projectTargetsForChat(targetModels, chatId, projectionContext);
  const coverage: HistoryCoverageInterval[] = normalizeCoverageIntervals(
    coverageRows.map((interval) => ({
      chatId,
      endAt: interval.endAt,
      startAt: interval.startAt
    }))
  );
  const missing = subtractIntervals(desired, coverage);
  const historyBeginningReached = coverage.some(isTelegramHistoryPastCovered);
  const earliestMessageDate = parseOptionalDate(facts.earliestMessageDate);
  const historyStartAt =
    historyBeginningReached && earliestMessageDate !== undefined ? earliestMessageDate : undefined;
  const displayedDesired = clipIntervalsForDisplay(desired, historyStartAt);
  const displayedCoverage = clipIntervalsForDisplay(coverage, historyStartAt);
  const displayedMissing = clipIntervalsForDisplay(missing, historyStartAt);
  const coverageMessageCounts = await telegram.countMessagesInIntervals({
    chatId,
    intervals: displayedCoverage.map(intervalToResponse)
  });

  return {
    chat: {
      historyBeginningReached,
      historyStartAt: historyStartAt?.toISOString() ?? null,
      id: chat.id,
      isBot: chat.isBot,
      messageCount: facts.messageCount,
      title: chat.title,
      type: chat.type,
      updatedAt: chat.updatedAt
    },
    coverage: displayedCoverage.map((interval, index) => ({
      ...intervalToResponse(interval),
      messageCount: coverageMessageCounts.counts[index] ?? 0
    })),
    desired: displayedDesired.map(intervalToResponse),
    jobs: jobRows.map((job) => ({
      cursor: job.cursor,
      endAt: job.endAt.toISOString(),
      id: String(job.id),
      startAt: job.startAt.toISOString(),
      status: job.status,
      updatedAt: job.updatedAt
    })),
    missing: displayedMissing.map(intervalToResponse),
    targets
  };
}

async function upsertHistoryTarget(runtime: HistoryRuntime, params: unknown): Promise<unknown> {
  const command = requireJsonObject(params, 'history.upsertTarget requires an object params');
  const target = await upsertManualHistoryTargetFromCommand(runtime.database, command);
  runtime.eventBus.publish(
    createIntegrationEvent({
      data: {
        target
      },
      source: 'history-sync',
      type: 'history.target.upserted'
    })
  );
  requestHistorySync(runtime, 'target-upserted');

  return {
    target,
    upserted: true
  };
}

async function deleteHistoryTarget(runtime: HistoryRuntime, params: unknown): Promise<unknown> {
  const command = requireJsonObject(params, 'history.deleteTarget requires an object params');
  const target = await deleteManualHistoryTargetFromCommand(runtime.database, command);
  runtime.eventBus.publish(
    createIntegrationEvent({
      data: {
        target
      },
      source: 'history-sync',
      type: 'history.target.deleted'
    })
  );
  requestHistorySync(runtime, 'target-deleted');

  return {
    deleted: true,
    target
  };
}

function publishHistorySyncRequested(
  runtime: HistoryRuntime,
  reason: string,
  chatId?: string
): void {
  runtime.eventBus.publish(
    createIntegrationEvent({
      data: {
        ...(chatId === undefined ? {} : { chatId }),
        reason
      },
      source: 'history-sync',
      type: 'history.sync.requested'
    })
  );
}

function requestHistorySync(runtime: HistoryRuntime, reason: string, chatId?: string): void {
  publishHistorySyncRequested(runtime, reason, chatId);
  runtime.requestSync?.(reason, chatId);
}

function requestHistorySyncFromRpc(runtime: HistoryRuntime, params: unknown): unknown {
  const input = asRecord(params);
  requestHistorySync(runtime, 'manual', asString(input?.chatId));

  return {
    requested: true
  };
}

async function listHistoryJobs(database: AppDatabase, params: unknown): Promise<unknown> {
  const input = asRecord(params);
  const status = asString(input?.status);
  const limit = parseLimit(input?.limit, 100, 500);
  if (status !== undefined && !activeBackfillJobStatuses.includes(status)) {
    return { jobs: [] };
  }

  const where =
    status === undefined
      ? inArray(historyBackfillJobs.status, activeBackfillJobStatuses)
      : eq(historyBackfillJobs.status, status);
  const rows = await database
    .select()
    .from(historyBackfillJobs)
    .where(where)
    .orderBy(desc(historyBackfillJobs.endAt), desc(historyBackfillJobs.startAt))
    .limit(limit);

  return {
    jobs: rows.map((job) => ({
      cursor: job.cursor,
      endAt: job.endAt,
      id: String(job.id),
      startAt: job.startAt,
      status: job.status,
      telegramChatId: job.telegramChatId,
      updatedAt: job.updatedAt
    }))
  };
}

function chatListFilterFromInput(input: Record<string, unknown> | undefined): ChatListFilter {
  const list = asString(input?.list);
  if (list === 'archive') {
    return { kind: 'archive' };
  }

  if (list === 'folder') {
    return {
      folderId: requireSafeInteger(
        input?.folderId,
        'history.listChats folder list requires folderId'
      ),
      kind: 'folder'
    };
  }

  return { kind: 'main' };
}

function historyChatNavigation(
  chats: TelegramChatDirectoryEntry[],
  folderRows: TelegramChatFolder[]
) {
  const folderCounts = new Map<number, number>();
  let archiveCount = 0;
  let mainCount = 0;

  for (const chat of chats) {
    if (chatMatchesListFilter(chat, { kind: 'main' })) {
      mainCount += 1;
    }
    if (chatMatchesListFilter(chat, { kind: 'archive' })) {
      archiveCount += 1;
    }
    for (const folderId of chatFolderIds(chat)) {
      folderCounts.set(folderId, (folderCounts.get(folderId) ?? 0) + 1);
    }
  }

  const knownFolderIds = new Set(folderRows.map((folder) => folder.id));
  const unknownFolderIds = [...folderCounts.keys()]
    .filter((id) => !knownFolderIds.has(id))
    .sort((left, right) => left - right);

  return {
    archiveCount,
    folders: [
      ...folderRows.map((folder) => ({
        count: folderCounts.get(folder.id) ?? 0,
        iconName: folder.iconName,
        id: folder.id,
        position: folder.position,
        title: folder.title
      })),
      ...unknownFolderIds.map((id) => ({
        count: folderCounts.get(id) ?? 0,
        iconName: null,
        id,
        title: `Folder ${String(id)}`
      }))
    ],
    mainCount
  };
}

function chatMatchesListFilter(chat: TelegramChatDirectoryEntry, filter: ChatListFilter): boolean {
  return chat.placements.some((placement) => chatPlacementMatchesFilter(placement, filter));
}

function chatFolderIds(chat: TelegramChatDirectoryEntry): number[] {
  return chat.placements
    .filter((placement) => placement.kind === 'folder')
    .map((placement) => placement.folderId);
}

function compareTelegramChatsByTdlibOrder(
  left: TelegramChatDirectoryEntry,
  right: TelegramChatDirectoryEntry,
  filter?: ChatListFilter
): number {
  const leftKey = telegramChatSortKey(left, filter);
  const rightKey = telegramChatSortKey(right, filter);

  if (leftKey.listRank !== rightKey.listRank) {
    return leftKey.listRank - rightKey.listRank;
  }

  const orderComparison = compareBigIntDescending(leftKey.order, rightKey.order);
  if (orderComparison !== 0) {
    return orderComparison;
  }

  if (leftKey.lastMessageDate !== rightKey.lastMessageDate) {
    return rightKey.lastMessageDate - leftKey.lastMessageDate;
  }

  return leftKey.title.localeCompare(rightKey.title) || leftKey.id.localeCompare(rightKey.id);
}

function telegramChatSortKey(
  chat: TelegramChatDirectoryEntry,
  filter?: ChatListFilter
): TelegramChatSortKey {
  const position = preferredChatPlacement(chat, filter);
  return {
    id: chat.id,
    lastMessageDate: chat.lastMessageDate,
    listRank: position?.listRank ?? 3,
    order: position?.order ?? 0n,
    title: chat.title
  };
}

function preferredChatPlacement(
  chat: TelegramChatDirectoryEntry,
  filter?: ChatListFilter
): { listRank: number; order: bigint } | undefined {
  const placements = chat.placements
    .map((placement) => {
      const order = parsePositiveBigInt(placement.order);
      if (order === undefined) {
        return undefined;
      }

      if (filter !== undefined && !chatPlacementMatchesFilter(placement, filter)) {
        return undefined;
      }

      return {
        listRank: chatPlacementRank(placement),
        order
      };
    })
    .filter(isDefined);

  return placements.sort((left, right) => {
    if (left.listRank !== right.listRank) {
      return left.listRank - right.listRank;
    }

    return compareBigIntDescending(left.order, right.order);
  })[0];
}

function chatPlacementMatchesFilter(
  placement: TelegramChatDirectoryEntry['placements'][number],
  filter: ChatListFilter
): boolean {
  if (filter.kind === 'main') {
    return placement.kind === 'main';
  }
  if (filter.kind === 'archive') {
    return placement.kind === 'archive';
  }
  return placement.kind === 'folder' && placement.folderId === filter.folderId;
}

function chatPlacementRank(placement: TelegramChatDirectoryEntry['placements'][number]): number {
  if (placement.kind === 'main') {
    return 0;
  }

  if (placement.kind === 'archive') {
    return 1;
  }

  return 2;
}

function compareBigIntDescending(left: bigint, right: bigint): number {
  if (left === right) {
    return 0;
  }

  return left > right ? -1 : 1;
}

function parsePositiveBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return BigInt(value);
  }

  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : undefined;
  }

  return undefined;
}

function toTargetResponse(
  row: {
    id: string;
    range: JsonObject;
    telegramChatId: string;
    templateId: string | null;
  },
  projectionContext: HistoryRangeProjectionContext
): HistoryTargetResponse {
  const range = canonicalizeHistoryRange(row.range as unknown as HistoryRange);
  const projected = projectHistoryRange(range, projectionContext);
  return {
    chatId: row.telegramChatId,
    id: row.id,
    projected: intervalToResponse(projected),
    range,
    templateId: row.templateId
  };
}

function toHistoryTarget(row: {
  id: string;
  range: JsonObject;
  telegramChatId: string;
  templateId: string | null;
}): HistoryTarget {
  return {
    chatId: row.telegramChatId,
    id: row.id,
    range: canonicalizeHistoryRange(row.range as unknown as HistoryRange),
    ...(row.templateId === null ? {} : { templateId: row.templateId })
  };
}

function intervalToResponse(interval: HistoryInterval): { endAt: string; startAt: string } {
  const normalized = normalizeTelegramHistoryInterval(interval);
  return {
    endAt: normalized.endAt.toISOString(),
    startAt: normalized.startAt.toISOString()
  };
}

function isTelegramHistoryPastCovered(interval: HistoryInterval): boolean {
  return interval.startAt.getTime() <= TELEGRAM_HISTORY_PAST_BOUNDARY.getTime();
}

function clipIntervalsForDisplay(
  intervals: HistoryInterval[],
  startAt: Date | undefined
): HistoryInterval[] {
  if (startAt === undefined) {
    return intervals;
  }

  return intervals
    .map((interval) => ({
      endAt: interval.endAt,
      startAt: interval.startAt < startAt ? startAt : interval.startAt
    }))
    .filter((interval) => interval.startAt < interval.endAt);
}

function parseLimit(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return fallback;
  }

  return Math.min(value, max);
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    groups.set(value, [...(groups.get(value) ?? []), item]);
  }
  return groups;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function minOptionalDate(values: Date[]): string | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((minimum, value) => (value < minimum ? value : minimum)).toISOString();
}

function maxOptionalDate(values: Date[]): string | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((maximum, value) => (value > maximum ? value : maximum)).toISOString();
}

function requireTelegramReadClient(runtime: HistoryRuntime): TelegramReadClient {
  if (runtime.telegram === undefined) {
    throw new Error('History runtime requires Telegram read client');
  }

  return runtime.telegram;
}

function parseOptionalDate(value: string | null): Date | undefined {
  if (value === null) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function requireString(value: unknown, message: string): string {
  const stringValue = asString(value);
  if (stringValue === undefined) {
    throw new Error(message);
  }
  return stringValue;
}

function requireSafeInteger(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(message);
  }

  return value;
}

function requireJsonObject(value: unknown, message: string): JsonObject {
  const record = asRecord(value);
  if (record === undefined || Array.isArray(value)) {
    throw new Error(message);
  }

  return record as JsonObject;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
