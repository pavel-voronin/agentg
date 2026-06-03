import { createHash } from 'node:crypto';

import type { Database } from '../database/client.js';

import type { HistorySyncRange, HistorySyncTarget } from '../model/types.js';
import { parseHistorySyncTargetUpsertCommand } from '../range/commands.js';
import { historySyncRangeKey } from '../range/ranges.js';
import {
  deleteHistorySyncTarget,
  listHistorySyncTargets,
  upsertHistorySyncTarget
} from './store.js';

export async function upsertManualHistorySyncTargetFromCommand(
  database: Database,
  command: unknown
): Promise<HistorySyncTarget> {
  const input = parseHistorySyncTargetUpsertCommand(command, 'history-sync.upsertTarget');
  const chatId = input.chatId;
  const range = input.range;
  const existingTargets = await listHistorySyncTargets(database);
  const rangeKey = historySyncRangeKey(range);
  const existingSameRange = existingTargets.find(
    (target) => target.chatId === chatId && historySyncRangeKey(target.range) === rangeKey
  );
  const target: HistorySyncTarget = {
    chatId,
    id: existingSameRange?.id ?? input.targetId ?? createManualTargetId(chatId, range),
    range
  };

  await upsertHistorySyncTarget(database, target);
  return target;
}

export async function deleteManualHistorySyncTargetFromCommand(
  database: Database,
  command: unknown
): Promise<HistorySyncTarget> {
  const input = asRecord(command);
  const targetId = requireString(input?.targetId, 'history-sync.deleteTarget requires targetId');
  const deleted = await deleteHistorySyncTarget(database, targetId);
  if (deleted === undefined) {
    throw new Error(`Unknown history target: ${targetId}`);
  }

  return deleted;
}

function createManualTargetId(chatId: string, range: HistorySyncRange): string {
  return `manual:${chatId}:${shortHash(`${chatId}:${historySyncRangeKey(range)}`)}`;
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
