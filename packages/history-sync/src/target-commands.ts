import { createHash } from 'node:crypto';

import type { AppDatabase } from '@agentg/database/client';

import { parseHistoryTargetUpsertCommand } from './commands.js';
import { historyRangeKey } from './ranges.js';
import { deleteHistoryTarget, listHistoryTargets, upsertHistoryTarget } from './store.js';
import type { HistoryRange, HistoryTarget } from './types.js';

export async function upsertManualHistoryTargetFromCommand(
  database: AppDatabase,
  command: unknown
): Promise<HistoryTarget> {
  const input = parseHistoryTargetUpsertCommand(command, 'history.target.upsert.requested');
  const chatId = input.chatId;
  const range = input.range;
  const existingTargets = await listHistoryTargets(database);
  const rangeKey = historyRangeKey(range);
  const existingSameRange = existingTargets.find(
    (target) => target.chatId === chatId && historyRangeKey(target.range) === rangeKey
  );
  const target: HistoryTarget = {
    chatId,
    id: existingSameRange?.id ?? input.targetId ?? createManualTargetId(chatId, range),
    range
  };

  await upsertHistoryTarget(database, target);
  return target;
}

export async function deleteManualHistoryTargetFromCommand(
  database: AppDatabase,
  command: unknown
): Promise<HistoryTarget> {
  const input = asRecord(command);
  const targetId = requireString(
    input?.targetId,
    'history.target.delete.requested requires targetId'
  );
  const deleted = await deleteHistoryTarget(database, targetId);
  if (deleted === undefined) {
    throw new Error(`Unknown history target: ${targetId}`);
  }

  return deleted;
}

function createManualTargetId(chatId: string, range: HistoryRange): string {
  return `manual:${chatId}:${shortHash(`${chatId}:${historyRangeKey(range)}`)}`;
}

function requireString(value: unknown, message: string): string {
  const stringValue =
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  if (stringValue === undefined) {
    throw new Error(message);
  }
  return stringValue;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}
