import type { AppDatabase } from '@agentg/database/client';
import { telegramSyncState } from '@agentg/database/schema';
import { eq, sql } from 'drizzle-orm';

import type { JsonObject } from './normalize.js';

export type BackfillSyncState = {
  fetchedCount: number;
  lastMessageId?: number;
  reachedEnd: boolean;
};

export type BackfillPhase = 'private' | 'group_channel' | 'complete';

export type BackfillSchedulerState = {
  groupChannelWindowEndIso: string;
  phase: BackfillPhase;
  privateWindowEndIso: string;
  version: 2;
};

export type BackfillChatWindowState = {
  cursorMessageId?: number;
  fetchedCount: number;
  phase: Exclude<BackfillPhase, 'complete'>;
  reachedBeginning: boolean;
  version: 2;
  windowComplete: boolean;
  windowEndIso: string;
  windowStartIso: string;
};

export async function getBackfillSyncState(
  database: AppDatabase,
  chatId: number
): Promise<BackfillSyncState | undefined> {
  const rows = await database
    .select({
      value: telegramSyncState.value
    })
    .from(telegramSyncState)
    .where(eq(telegramSyncState.key, backfillSyncKey(chatId)))
    .limit(1);

  return parseBackfillSyncState(rows[0]?.value);
}

export async function getBackfillSchedulerState(
  database: AppDatabase
): Promise<BackfillSchedulerState | undefined> {
  const rows = await database
    .select({
      value: telegramSyncState.value
    })
    .from(telegramSyncState)
    .where(eq(telegramSyncState.key, backfillSchedulerKey()))
    .limit(1);

  return parseBackfillSchedulerState(rows[0]?.value);
}

export async function setBackfillSchedulerState(
  database: AppDatabase,
  state: BackfillSchedulerState
): Promise<void> {
  await upsertSyncState(database, backfillSchedulerKey(), state);
}

export async function getBackfillChatWindowState(
  database: AppDatabase,
  phase: Exclude<BackfillPhase, 'complete'>,
  chatId: number
): Promise<BackfillChatWindowState | undefined> {
  const rows = await database
    .select({
      value: telegramSyncState.value
    })
    .from(telegramSyncState)
    .where(eq(telegramSyncState.key, backfillChatWindowKey(phase, chatId)))
    .limit(1);

  return parseBackfillChatWindowState(rows[0]?.value);
}

export async function setBackfillChatWindowState(
  database: AppDatabase,
  chatId: number,
  state: BackfillChatWindowState
): Promise<void> {
  await upsertSyncState(database, backfillChatWindowKey(state.phase, chatId), state);
}

export async function setBackfillSyncState(
  database: AppDatabase,
  chatId: number,
  state: BackfillSyncState
): Promise<void> {
  await upsertSyncState(database, backfillSyncKey(chatId), state);
}

async function upsertSyncState(
  database: AppDatabase,
  key: string,
  state: JsonObject | object
): Promise<void> {
  await database
    .insert(telegramSyncState)
    .values({
      key,
      value: toJsonObject(state)
    })
    .onConflictDoUpdate({
      set: {
        updatedAt: sql`now()`,
        value: toJsonObject(state)
      },
      target: telegramSyncState.key
    });
}

function backfillSyncKey(chatId: number): string {
  return `telegram:backfill:${String(chatId)}`;
}

function backfillSchedulerKey(): string {
  return 'telegram:backfill:v2:scheduler';
}

function backfillChatWindowKey(phase: Exclude<BackfillPhase, 'complete'>, chatId: number): string {
  return `telegram:backfill:v2:${phase}:${String(chatId)}`;
}

function parseBackfillSyncState(value: JsonObject | undefined): BackfillSyncState | undefined {
  if (value === undefined) {
    return undefined;
  }

  const fetchedCount = typeof value.fetchedCount === 'number' ? value.fetchedCount : 0;
  const lastMessageId = typeof value.lastMessageId === 'number' ? value.lastMessageId : undefined;
  const reachedEnd = value.reachedEnd === true;

  return {
    fetchedCount,
    ...(lastMessageId === undefined ? {} : { lastMessageId }),
    reachedEnd
  };
}

function parseBackfillSchedulerState(
  value: JsonObject | undefined
): BackfillSchedulerState | undefined {
  if (value?.version !== 2) {
    return undefined;
  }

  if (
    !isBackfillPhase(value.phase) ||
    typeof value.privateWindowEndIso !== 'string' ||
    typeof value.groupChannelWindowEndIso !== 'string'
  ) {
    return undefined;
  }

  return {
    groupChannelWindowEndIso: value.groupChannelWindowEndIso,
    phase: value.phase,
    privateWindowEndIso: value.privateWindowEndIso,
    version: 2
  };
}

function parseBackfillChatWindowState(
  value: JsonObject | undefined
): BackfillChatWindowState | undefined {
  if (value?.version !== 2) {
    return undefined;
  }

  if (
    (value.phase !== 'private' && value.phase !== 'group_channel') ||
    typeof value.fetchedCount !== 'number' ||
    typeof value.reachedBeginning !== 'boolean' ||
    typeof value.windowComplete !== 'boolean' ||
    typeof value.windowEndIso !== 'string' ||
    typeof value.windowStartIso !== 'string'
  ) {
    return undefined;
  }

  const cursorMessageId =
    typeof value.cursorMessageId === 'number' ? value.cursorMessageId : undefined;

  return {
    ...(cursorMessageId === undefined ? {} : { cursorMessageId }),
    fetchedCount: value.fetchedCount,
    phase: value.phase,
    reachedBeginning: value.reachedBeginning,
    version: 2,
    windowComplete: value.windowComplete,
    windowEndIso: value.windowEndIso,
    windowStartIso: value.windowStartIso
  };
}

function isBackfillPhase(value: unknown): value is BackfillPhase {
  return value === 'private' || value === 'group_channel' || value === 'complete';
}

function toJsonObject(value: object): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}
