import type { JsonObject } from '@agentg/events/json';

import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../../constants.js';
import {
  canonicalizeHistorySyncRange,
  projectHistorySyncRange,
  type HistorySyncRangeProjectionContext
} from '../../ranges.js';
import type { TelegramReadClient } from '../../telegramClient.js';
import { floorToTelegramSecond, normalizeTelegramHistoryInterval } from '../../time.js';
import type { HistorySyncInterval, HistorySyncRange, HistorySyncTarget } from '../../types.js';
import type { HistorySyncRuntime } from '../runtime.js';

export type HistorySyncTargetResponse = {
  chatId: string;
  id: string;
  projected: {
    endAt: string;
    startAt: string;
  };
  range: HistorySyncRange;
  templateId: string | null;
};

export function currentHistorySyncProjectionContext(): HistorySyncRangeProjectionContext {
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
  projectionContext: HistorySyncRangeProjectionContext
): HistorySyncTargetResponse {
  return historySyncTargetToResponse(toHistorySyncTarget(row), projectionContext);
}

export function historySyncTargetToResponse(
  target: HistorySyncTarget,
  projectionContext: HistorySyncRangeProjectionContext
): HistorySyncTargetResponse {
  const range = canonicalizeHistorySyncRange(target.range);
  const projected = projectHistorySyncRange(range, projectionContext);
  return {
    chatId: target.chatId,
    id: target.id,
    projected: intervalToResponse(projected),
    range,
    templateId: target.templateId ?? null
  };
}

export function toHistorySyncTarget(row: {
  id: string;
  range: JsonObject;
  telegramChatId: string;
  templateId: string | null;
}): HistorySyncTarget {
  return {
    chatId: row.telegramChatId,
    id: row.id,
    range: canonicalizeHistorySyncRange(row.range as unknown as HistorySyncRange),
    ...(row.templateId === null ? {} : { templateId: row.templateId })
  };
}

export function intervalToResponse(interval: HistorySyncInterval): {
  endAt: string;
  startAt: string;
} {
  const normalized = normalizeTelegramHistoryInterval(interval);
  return {
    endAt: normalized.endAt.toISOString(),
    startAt: normalized.startAt.toISOString()
  };
}

export function isTelegramHistoryPastCovered(interval: HistorySyncInterval): boolean {
  return interval.startAt.getTime() <= TELEGRAM_HISTORY_PAST_BOUNDARY.getTime();
}

export function clipIntervalsForDisplay<T extends HistorySyncInterval>(
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

export function requireTelegramReadClient(runtime: HistorySyncRuntime): TelegramReadClient {
  if (runtime.telegram === undefined) {
    throw new Error('History Sync runtime requires Telegram read client');
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
