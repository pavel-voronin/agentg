import type { AppDatabase } from '@agentg/database/client';
import {
  backfillJobs,
  telegramChatFolders,
  historyCoverage,
  historyTargets,
  historyTemplates,
  telegramChats,
  telegramMessages,
  telegramUsers
} from '@agentg/database/schema';
import type { EventBus } from '@agentg/shared/events/bus';
import { createIntegrationEvent } from '@agentg/shared/events/envelope';
import type { JsonObject } from '@agentg/shared/json';
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lt, sql } from 'drizzle-orm';

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

type TelegramChatListRow = {
  raw: JsonObject;
  telegramChatId: string;
  title: string;
  type: string;
};

type TelegramChatUserInfo = {
  isBot: boolean;
  isSelf: boolean;
  telegramUserId: string;
};

type TelegramChatFolderRow = {
  iconName: string | null;
  position: number;
  telegramChatFolderId: number;
  title: string;
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

export type TelegramHistoryRuntime = {
  database: AppDatabase;
  eventBus: EventBus;
};

const activeBackfillJobStatuses = ['pending', 'running'];

export async function callTelegramHistoryMethod(
  runtime: TelegramHistoryRuntime,
  method: string,
  params: unknown
): Promise<unknown> {
  if (method === 'history.getOverview') {
    return getHistoryOverview(runtime.database);
  }

  if (method === 'history.listChats') {
    return listHistoryChats(runtime.database, params);
  }

  if (method === 'history.getChatHistoryState') {
    return getChatHistoryState(runtime.database, params);
  }

  if (method === 'history.upsertTarget') {
    return upsertHistoryTarget(runtime, params);
  }

  if (method === 'history.deleteTarget') {
    return deleteHistoryTarget(runtime, params);
  }

  if (method === 'history.requestSync') {
    return requestHistorySync(runtime, params);
  }

  if (method === 'history.listJobs') {
    return listHistoryJobs(runtime.database, params);
  }

  return undefined;
}

async function getHistoryOverview(database: AppDatabase): Promise<unknown> {
  const [chats, templates, targets, coverage, activeJobs] = await Promise.all([
    database.select({ id: telegramChats.telegramChatId }).from(telegramChats),
    database.select({ id: historyTemplates.id }).from(historyTemplates),
    database.select({ id: historyTargets.id }).from(historyTargets),
    database.select({ id: historyCoverage.id }).from(historyCoverage),
    database
      .select({
        endAt: backfillJobs.endAt,
        startAt: backfillJobs.startAt,
        status: backfillJobs.status,
        telegramChatId: backfillJobs.telegramChatId
      })
      .from(backfillJobs)
      .where(inArray(backfillJobs.status, activeBackfillJobStatuses))
      .orderBy(desc(backfillJobs.status), desc(backfillJobs.endAt), desc(backfillJobs.startAt))
      .limit(1)
  ]);
  const jobs = await database
    .select({
      status: backfillJobs.status
    })
    .from(backfillJobs)
    .where(inArray(backfillJobs.status, activeBackfillJobStatuses));
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
    chats: chats.length,
    coverageIntervals: coverage.length,
    pendingJobs: jobCounts.pending ?? 0,
    runningJobs: jobCounts.running ?? 0,
    targets: targets.length,
    templates: templates.length
  };
}

async function listHistoryChats(database: AppDatabase, params: unknown): Promise<unknown> {
  const input = asRecord(params);
  const query = asString(input?.query)?.trim();
  const type = asString(input?.type)?.trim();
  const limit = parseLimit(input?.limit, 100, 500);
  const listFilter =
    query === undefined || query.length === 0 ? chatListFilterFromInput(input) : undefined;
  const queryWhere = query === undefined || query.length === 0 ? undefined : chatSearchWhere(query);
  const where = andSql(queryWhere, type === undefined ? undefined : eq(telegramChats.type, type));
  const navigationWhere = type === undefined ? undefined : eq(telegramChats.type, type);

  const [matchingChats, navigationChats, types, folders] = await Promise.all([
    database
      .select()
      .from(telegramChats)
      .where(where)
      .orderBy(asc(telegramChats.title), asc(telegramChats.telegramChatId)),
    database
      .select()
      .from(telegramChats)
      .where(navigationWhere)
      .orderBy(asc(telegramChats.title), asc(telegramChats.telegramChatId)),
    database
      .select({
        count: sql<number>`count(*)::int`,
        type: telegramChats.type
      })
      .from(telegramChats)
      .groupBy(telegramChats.type)
      .orderBy(asc(telegramChats.type)),
    database
      .select({
        iconName: telegramChatFolders.iconName,
        position: telegramChatFolders.position,
        telegramChatFolderId: telegramChatFolders.telegramChatFolderId,
        title: telegramChatFolders.title
      })
      .from(telegramChatFolders)
      .orderBy(asc(telegramChatFolders.position), asc(telegramChatFolders.telegramChatFolderId))
  ]);
  const chats = matchingChats
    .filter((chat) =>
      listFilter === undefined ? true : chatMatchesListFilter(chat.raw, listFilter)
    )
    .sort((left, right) => compareTelegramChatsByTdlibOrder(left, right, listFilter))
    .slice(0, limit);
  const chatIds = chats.map((chat) => chat.telegramChatId);
  const userIds = chats.map((chat) => telegramChatUserId(chat.raw)).filter(isDefined);
  const [targets, coverage, jobs, users] =
    chatIds.length === 0
      ? [[], [], [], []]
      : await Promise.all([
          database
            .select({
              telegramChatId: historyTargets.telegramChatId
            })
            .from(historyTargets)
            .where(inArray(historyTargets.telegramChatId, chatIds)),
          database
            .select({
              endAt: historyCoverage.endAt,
              startAt: historyCoverage.startAt,
              telegramChatId: historyCoverage.telegramChatId
            })
            .from(historyCoverage)
            .where(inArray(historyCoverage.telegramChatId, chatIds)),
          database
            .select({
              status: backfillJobs.status,
              telegramChatId: backfillJobs.telegramChatId
            })
            .from(backfillJobs)
            .where(
              and(
                inArray(backfillJobs.telegramChatId, chatIds),
                inArray(backfillJobs.status, activeBackfillJobStatuses)
              )
            ),
          userIds.length === 0
            ? []
            : database
                .select({
                  isBot: telegramUsers.isBot,
                  isSelf: telegramUsers.isSelf,
                  telegramUserId: telegramUsers.telegramUserId
                })
                .from(telegramUsers)
                .where(inArray(telegramUsers.telegramUserId, userIds))
        ]);

  const targetsByChat = countBy(targets, (target) => target.telegramChatId);
  const jobsByChat = groupBy(jobs, (job) => job.telegramChatId);
  const coverageByChat = groupBy(coverage, (interval) => interval.telegramChatId);
  const usersById = new Map(users.map((user) => [user.telegramUserId, user]));

  return {
    chats: chats.map((chat) => {
      const chatCoverage = coverageByChat.get(chat.telegramChatId) ?? [];
      const chatJobs = jobsByChat.get(chat.telegramChatId) ?? [];
      const jobCounts = countBy(chatJobs, (job) => job.status);
      const chatUser = usersById.get(telegramChatUserId(chat.raw) ?? '');

      return {
        coverageIntervals: chatCoverage.length,
        coverageNewestAt: maxOptionalDate(chatCoverage.map((interval) => interval.endAt)),
        coverageOldestAt: minOptionalDate(chatCoverage.map((interval) => interval.startAt)),
        id: chat.telegramChatId,
        isBot: chatUser?.isBot === true,
        pendingJobs: jobCounts.pending ?? 0,
        runningJobs: jobCounts.running ?? 0,
        targets: targetsByChat[chat.telegramChatId] ?? 0,
        title: telegramChatDisplayTitle(chat, chatUser),
        type: chat.type,
        updatedAt: chat.updatedAt
      };
    }),
    navigation: historyChatNavigation(navigationChats, folders),
    types
  };
}

async function getChatHistoryState(database: AppDatabase, params: unknown): Promise<unknown> {
  const input = asRecord(params);
  const chatId = requireString(input?.chatId, 'history.getChatHistoryState requires chatId');
  const [chat] = await database
    .select()
    .from(telegramChats)
    .where(eq(telegramChats.telegramChatId, chatId))
    .limit(1);
  if (chat === undefined) {
    return {
      chat: null,
      coverage: [],
      desired: [],
      jobs: [],
      missing: [],
      targets: []
    };
  }

  const chatUserId = telegramChatUserId(chat.raw);
  const [targetRows, coverageRows, jobRows, earliestMessageRows, messageCountRows, chatUserRows] =
    await Promise.all([
      database
        .select()
        .from(historyTargets)
        .where(eq(historyTargets.telegramChatId, chatId))
        .orderBy(asc(historyTargets.id)),
      database
        .select()
        .from(historyCoverage)
        .where(eq(historyCoverage.telegramChatId, chatId))
        .orderBy(asc(historyCoverage.startAt)),
      database
        .select()
        .from(backfillJobs)
        .where(
          and(
            eq(backfillJobs.telegramChatId, chatId),
            inArray(backfillJobs.status, activeBackfillJobStatuses)
          )
        )
        .orderBy(desc(backfillJobs.endAt), desc(backfillJobs.startAt))
        .limit(200),
      database
        .select({
          messageDate: telegramMessages.messageDate
        })
        .from(telegramMessages)
        .where(
          and(eq(telegramMessages.telegramChatId, chatId), isNotNull(telegramMessages.messageDate))
        )
        .orderBy(asc(telegramMessages.messageDate))
        .limit(1),
      database
        .select({
          count: sql<number>`count(*)::int`
        })
        .from(telegramMessages)
        .where(eq(telegramMessages.telegramChatId, chatId)),
      chatUserId === undefined
        ? []
        : database
            .select({
              isBot: telegramUsers.isBot,
              isSelf: telegramUsers.isSelf,
              telegramUserId: telegramUsers.telegramUserId
            })
            .from(telegramUsers)
            .where(eq(telegramUsers.telegramUserId, chatUserId))
            .limit(1)
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
  const historyStartAt =
    historyBeginningReached && earliestMessageRows[0]?.messageDate !== null
      ? earliestMessageRows[0]?.messageDate
      : undefined;
  const displayedDesired = clipIntervalsForDisplay(desired, historyStartAt);
  const displayedCoverage = clipIntervalsForDisplay(coverage, historyStartAt);
  const displayedMissing = clipIntervalsForDisplay(missing, historyStartAt);
  const coverageMessageCounts = await countMessagesForIntervals(
    database,
    chatId,
    displayedCoverage
  );

  return {
    chat: {
      historyBeginningReached,
      historyStartAt: historyStartAt?.toISOString() ?? null,
      id: chat.telegramChatId,
      isBot: chatUserRows[0]?.isBot === true,
      messageCount: messageCountRows[0]?.count ?? 0,
      title: telegramChatDisplayTitle(chat, chatUserRows[0]),
      type: chat.type,
      updatedAt: chat.updatedAt
    },
    coverage: displayedCoverage.map((interval, index) => ({
      ...intervalToResponse(interval),
      messageCount: coverageMessageCounts[index] ?? 0
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

async function upsertHistoryTarget(
  runtime: TelegramHistoryRuntime,
  params: unknown
): Promise<unknown> {
  const command = requireJsonObject(params, 'history.upsertTarget requires an object params');
  const target = await upsertManualHistoryTargetFromCommand(runtime.database, command);
  runtime.eventBus.publish(
    createIntegrationEvent({
      data: {
        target
      },
      source: 'telegram.history-sync',
      type: 'history.target.upserted'
    })
  );
  publishHistorySyncRequested(runtime.eventBus, 'target-upserted');

  return {
    target,
    upserted: true
  };
}

async function deleteHistoryTarget(
  runtime: TelegramHistoryRuntime,
  params: unknown
): Promise<unknown> {
  const command = requireJsonObject(params, 'history.deleteTarget requires an object params');
  const target = await deleteManualHistoryTargetFromCommand(runtime.database, command);
  runtime.eventBus.publish(
    createIntegrationEvent({
      data: {
        target
      },
      source: 'telegram.history-sync',
      type: 'history.target.deleted'
    })
  );
  publishHistorySyncRequested(runtime.eventBus, 'target-deleted');

  return {
    deleted: true,
    target
  };
}

function publishHistorySyncRequested(eventBus: EventBus, reason: string, chatId?: string): void {
  eventBus.publish(
    createIntegrationEvent({
      data: {
        ...(chatId === undefined ? {} : { chatId }),
        reason
      },
      source: 'agent-gateway',
      type: 'history.sync.requested'
    })
  );
}

function requestHistorySync(runtime: TelegramHistoryRuntime, params: unknown): unknown {
  const input = asRecord(params);
  publishHistorySyncRequested(runtime.eventBus, 'manual', asString(input?.chatId));

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
      ? inArray(backfillJobs.status, activeBackfillJobStatuses)
      : eq(backfillJobs.status, status);
  const rows = await database
    .select()
    .from(backfillJobs)
    .where(where)
    .orderBy(desc(backfillJobs.endAt), desc(backfillJobs.startAt))
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

function chatSearchWhere(query: string) {
  return orSql(
    ilike(telegramChats.title, `%${query}%`),
    ilike(telegramChats.telegramChatId, `%${query}%`)
  );
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

function historyChatNavigation(chats: TelegramChatListRow[], folderRows: TelegramChatFolderRow[]) {
  const folderCounts = new Map<number, number>();
  let archiveCount = 0;
  let mainCount = 0;

  for (const chat of chats) {
    if (chatMatchesListFilter(chat.raw, { kind: 'main' })) {
      mainCount += 1;
    }
    if (chatMatchesListFilter(chat.raw, { kind: 'archive' })) {
      archiveCount += 1;
    }
    for (const folderId of chatFolderIds(chat.raw)) {
      folderCounts.set(folderId, (folderCounts.get(folderId) ?? 0) + 1);
    }
  }

  const knownFolderIds = new Set(folderRows.map((folder) => folder.telegramChatFolderId));
  const unknownFolderIds = [...folderCounts.keys()]
    .filter((id) => !knownFolderIds.has(id))
    .sort((left, right) => left - right);

  return {
    archiveCount,
    folders: [
      ...folderRows.map((folder) => ({
        count: folderCounts.get(folder.telegramChatFolderId) ?? 0,
        iconName: folder.iconName,
        id: folder.telegramChatFolderId,
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

function chatMatchesListFilter(raw: JsonObject, filter: ChatListFilter): boolean {
  return chatPositions(raw).some((position) => {
    const list = asPlainRecord(position.list);
    const type = typeof list?._ === 'string' ? list._ : undefined;
    if (filter.kind === 'main') {
      return type === 'chatListMain';
    }
    if (filter.kind === 'archive') {
      return type === 'chatListArchive';
    }
    return type === 'chatListFolder' && chatFolderId(list) === filter.folderId;
  });
}

function chatFolderIds(raw: JsonObject): number[] {
  return chatPositions(raw)
    .map((position) => asPlainRecord(position.list))
    .filter(isDefined)
    .filter((list) => list._ === 'chatListFolder')
    .map(chatFolderId)
    .filter(isDefined);
}

function chatPositions(raw: JsonObject): Record<string, unknown>[] {
  return (Array.isArray(raw.positions) ? raw.positions : []).map(asPlainRecord).filter(isDefined);
}

function compareTelegramChatsByTdlibOrder(
  left: TelegramChatListRow,
  right: TelegramChatListRow,
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
  chat: TelegramChatListRow,
  filter?: ChatListFilter
): TelegramChatSortKey {
  const position = preferredChatPosition(chat.raw, filter);
  return {
    id: chat.telegramChatId,
    lastMessageDate: telegramChatLastMessageDate(chat.raw),
    listRank: position?.listRank ?? 3,
    order: position?.order ?? 0n,
    title: chat.title
  };
}

function preferredChatPosition(
  raw: JsonObject,
  filter?: ChatListFilter
): { listRank: number; order: bigint } | undefined {
  const parsedPositions = chatPositions(raw)
    .map((record) => {
      const order = parsePositiveBigInt(record.order);
      if (order === undefined) {
        return undefined;
      }

      const list = asPlainRecord(record.list);
      if (filter !== undefined && !chatListMatchesFilter(list, filter)) {
        return undefined;
      }

      return {
        listRank: chatListRank(list),
        order
      };
    })
    .filter(isDefined);

  return parsedPositions.sort((left, right) => {
    if (left.listRank !== right.listRank) {
      return left.listRank - right.listRank;
    }

    return compareBigIntDescending(left.order, right.order);
  })[0];
}

function chatListMatchesFilter(
  list: Record<string, unknown> | undefined,
  filter: ChatListFilter
): boolean {
  const type = typeof list?._ === 'string' ? list._ : undefined;
  if (filter.kind === 'main') {
    return type === 'chatListMain';
  }
  if (filter.kind === 'archive') {
    return type === 'chatListArchive';
  }
  return type === 'chatListFolder' && chatFolderId(list) === filter.folderId;
}

function chatListRank(list: Record<string, unknown> | undefined): number {
  const type = typeof list?._ === 'string' ? list._ : undefined;

  if (type === 'chatListMain') {
    return 0;
  }

  if (type === 'chatListArchive') {
    return 1;
  }

  return 2;
}

function chatFolderId(list: Record<string, unknown> | undefined): number | undefined {
  const value = list?.chat_folder_id ?? list?.chatFolderId;
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function telegramChatLastMessageDate(raw: JsonObject): number {
  const lastMessage = asPlainRecord(raw.last_message) ?? asPlainRecord(raw.lastMessage);
  return typeof lastMessage?.date === 'number' ? lastMessage.date : 0;
}

function telegramChatUserId(raw: JsonObject): string | undefined {
  const type = asPlainRecord(raw.type);
  const userId = type?.user_id ?? type?.userId;
  if (typeof userId === 'number' || typeof userId === 'string') {
    return String(userId);
  }
  return undefined;
}

function telegramChatDisplayTitle(
  chat: { title: string; type: string },
  user: TelegramChatUserInfo | undefined
): string {
  return chat.type === 'private' && user?.isSelf === true ? 'Saved Messages' : chat.title;
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

function andSql(...conditions: (ReturnType<typeof eq> | undefined)[]) {
  const defined = conditions.filter((condition) => condition !== undefined);
  return defined.length === 0 ? undefined : and(...defined);
}

function orSql(first: ReturnType<typeof ilike>, second: ReturnType<typeof ilike>) {
  return sql`(${first} or ${second})`;
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

async function countMessagesForIntervals(
  database: AppDatabase,
  chatId: string,
  intervals: HistoryInterval[]
): Promise<number[]> {
  return Promise.all(
    intervals.map(async (interval) => {
      const [row] = await database
        .select({
          count: sql<number>`count(*)::int`
        })
        .from(telegramMessages)
        .where(
          and(
            eq(telegramMessages.telegramChatId, chatId),
            isNotNull(telegramMessages.messageDate),
            gte(telegramMessages.messageDate, interval.startAt),
            lt(telegramMessages.messageDate, interval.endAt)
          )
        );

      return row?.count ?? 0;
    })
  );
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

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
