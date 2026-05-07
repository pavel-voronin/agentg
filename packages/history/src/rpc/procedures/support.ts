import type { JsonObject } from '@agentg/events/json';

import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../../constants.js';
import {
  canonicalizeHistoryRange,
  projectHistoryRange,
  type HistoryRangeProjectionContext
} from '../../ranges.js';
import type { TelegramReadClient } from '../../telegram-client.js';
import { floorToTelegramSecond, normalizeTelegramHistoryInterval } from '../../time.js';
import type {
  HistoryCoverageInterval,
  HistoryInterval,
  HistoryRange,
  HistoryTarget
} from '../../types.js';
import type { HistoryRuntime } from '../runtime.js';

export const activeBackfillJobStatuses = ['pending', 'running'];

export type HistoryTargetResponse = {
  chatId: string;
  id: string;
  projected: {
    endAt: string;
    startAt: string;
  };
  range: HistoryRange;
  templateId: string | null;
};

export function currentHistoryProjectionContext(): HistoryRangeProjectionContext {
  return {
    literals: {
      past: TELEGRAM_HISTORY_PAST_BOUNDARY
    },
    now: floorToTelegramSecond(new Date())
  };
}

export function toTargetResponse(
  row: {
    id: string;
    range: JsonObject;
    telegramChatId: string;
    templateId: string | null;
  },
  projectionContext: HistoryRangeProjectionContext
): HistoryTargetResponse {
  return historyTargetToResponse(toHistoryTarget(row), projectionContext);
}

export function historyTargetToResponse(
  target: HistoryTarget,
  projectionContext: HistoryRangeProjectionContext
): HistoryTargetResponse {
  const range = canonicalizeHistoryRange(target.range);
  const projected = projectHistoryRange(range, projectionContext);
  return {
    chatId: target.chatId,
    id: target.id,
    projected: intervalToResponse(projected),
    range,
    templateId: target.templateId ?? null
  };
}

export function toHistoryTarget(row: {
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

export function intervalToResponse(interval: HistoryInterval): { endAt: string; startAt: string } {
  const normalized = normalizeTelegramHistoryInterval(interval);
  return {
    endAt: normalized.endAt.toISOString(),
    startAt: normalized.startAt.toISOString()
  };
}

export function isTelegramHistoryPastCovered(interval: HistoryInterval): boolean {
  return interval.startAt.getTime() <= TELEGRAM_HISTORY_PAST_BOUNDARY.getTime();
}

export function clipIntervalsForDisplay(
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

export function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    groups.set(value, [...(groups.get(value) ?? []), item]);
  }
  return groups;
}

export function minOptionalDate(values: Date[]): string | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((minimum, value) => (value < minimum ? value : minimum)).toISOString();
}

export function maxOptionalDate(values: Date[]): string | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((maximum, value) => (value > maximum ? value : maximum)).toISOString();
}

export function requireTelegramReadClient(runtime: HistoryRuntime): TelegramReadClient {
  if (runtime.telegram === undefined) {
    throw new Error('History runtime requires Telegram read client');
  }

  return runtime.telegram;
}

export function parseOptionalDate(value: string | null): Date | undefined {
  if (value === null) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function historyCoverageIntervals(
  intervals: { endAt: Date; startAt: Date }[],
  chatId: string
): HistoryCoverageInterval[] {
  return intervals.map((interval) => ({
    chatId,
    endAt: interval.endAt,
    startAt: interval.startAt
  }));
}
