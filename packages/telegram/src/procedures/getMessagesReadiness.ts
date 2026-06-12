import { and, eq, sql } from 'drizzle-orm';

import { telegramMessages } from '../database/schema.js';
import {
  listHistoryCoverage,
  subtractHistoryIntervals,
  type HistoryCoverageSegment
} from '../history/coverage.js';
import { HISTORY_PAST_BOUNDARY, HISTORY_TICK_MS, type HistoryInterval } from '../history/time.js';
import { readMessageSelection, toReadMessages, type MessageStorageRow } from '../views/message.js';
import type { ProcedureResources } from './resources.js';

type GetMessagesRequest = {
  beforeMessageId?: string | undefined;
  chatId: string;
  limit: number;
  pageEndAt: string;
};

type PersistedPage = {
  messages: MessageStorageRow[];
};

export async function readReadyGetMessages(
  request: GetMessagesRequest,
  resources: ProcedureResources
) {
  const persisted = await readPersistedGetMessages(request, resources);
  const coverage = await listHistoryCoverage(resources.database, request.chatId);
  const readiness = pageReadinessInterval(request, persisted.messages);
  if (readiness === undefined || !isCovered(readiness.interval, coverage)) {
    return undefined;
  }

  return toGetMessagesOutput(persisted.messages, readiness.reachedStart, resources);
}

export async function readMaterializedGetMessages(
  request: GetMessagesRequest,
  resources: ProcedureResources,
  input: {
    reachedStart: boolean;
  }
) {
  const persisted = await readPersistedGetMessages(request, resources);
  const readiness = pageReadinessInterval(request, persisted.messages);
  if (readiness === undefined) {
    throw new Error('telegram.getMessages materialized page is not ready');
  }
  return toGetMessagesOutput(
    persisted.messages,
    input.reachedStart || readiness.reachedStart,
    resources
  );
}

async function toGetMessagesOutput(
  messages: MessageStorageRow[],
  reachedStart: boolean,
  resources: ProcedureResources
) {
  return {
    messages: await toReadMessages(resources.database, messages),
    reachedStart
  };
}

async function readPersistedGetMessages(
  request: GetMessagesRequest,
  resources: ProcedureResources
): Promise<PersistedPage> {
  const before =
    request.beforeMessageId === undefined ? undefined : Number(request.beforeMessageId);
  const rows = await resources.database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(
      and(
        eq(telegramMessages.chatId, request.chatId),
        before === undefined ? undefined : sql`${telegramMessages.id}::bigint < ${before}`
      )
    )
    .orderBy(sql`${telegramMessages.id}::bigint desc`)
    .limit(request.limit);
  const messages = [...rows].reverse();

  return {
    messages
  };
}

function pageReadinessInterval(
  request: GetMessagesRequest,
  messages: MessageStorageRow[]
): { interval: HistoryInterval; reachedStart: boolean } | undefined {
  const requestedEndAt = new Date(request.pageEndAt);
  if (!hasDatedPageBoundary(messages)) {
    return undefined;
  }

  if (messages.length < request.limit) {
    return {
      interval: {
        endAt: requestedEndAt,
        startAt: HISTORY_PAST_BOUNDARY
      },
      reachedStart: true
    };
  }

  const oldest = messages[0];
  if (oldest?.messageDate === undefined || oldest.messageDate === null) {
    return undefined;
  }

  return {
    interval: {
      endAt: requestedEndAt,
      startAt: nextHistorySecond(new Date(oldest.messageDate))
    },
    reachedStart: false
  };
}

function hasDatedPageBoundary(messages: MessageStorageRow[]): boolean {
  const newest = messages[messages.length - 1];
  if (newest === undefined) {
    return true;
  }
  return newest.messageDate !== null;
}

function isCovered(interval: HistoryInterval, coverage: HistoryCoverageSegment[]): boolean {
  if (interval.startAt >= interval.endAt) {
    return false;
  }
  return subtractHistoryIntervals([interval], coverage).length === 0;
}

function nextHistorySecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / HISTORY_TICK_MS) * HISTORY_TICK_MS + HISTORY_TICK_MS);
}
