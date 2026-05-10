import type { JsonObject } from '@agentg/events/json';

import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../../constants.js';
import {
  canonicalizeHistoryRange,
  projectHistoryRange,
  type HistoryRangeProjectionContext
} from '../../ranges.js';
import type { TelegramReadClient } from '../../telegram-client.js';
import { floorToTelegramSecond, normalizeTelegramHistoryInterval } from '../../time.js';
import type { HistoryInterval, HistoryRange, HistoryTarget } from '../../types.js';
import type { HistoryRuntime } from '../runtime.js';

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

export function clipIntervalsForDisplay<T extends HistoryInterval>(
  intervals: T[],
  startAt: Date | undefined
): T[] {
  if (startAt === undefined) {
    return intervals;
  }

  return intervals
    .map((interval) => ({
      ...interval,
      endAt: interval.endAt,
      startAt: interval.startAt < startAt ? startAt : interval.startAt
    }))
    .filter((interval) => interval.startAt < interval.endAt);
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
