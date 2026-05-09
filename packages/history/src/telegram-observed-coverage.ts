import type { IntegrationEvent } from '@agentg/events/envelope';

import { TELEGRAM_HISTORY_PAST_BOUNDARY } from './constants.js';
import { normalizeTelegramHistoryInterval } from './time.js';
import type { HistoryCoverageInterval } from './types.js';

export function coverageIntervalsFromTelegramMessagesObserved(
  event: IntegrationEvent
): HistoryCoverageInterval[] {
  if (event.type !== 'telegram.messages.observed') {
    return [];
  }

  const data = asRecord(event.data);
  const interval = asRecord(data?.interval);
  const chatId = asString(asRecord(data?.chat)?.id) ?? asString(event.meta?.chatId);
  const endAt = parseDate(interval?.endAt);
  const startAt = parseObservedStartAt(interval?.startAt, data?.reachedStart === true);
  if (chatId === undefined || endAt === undefined || startAt === undefined) {
    return [];
  }

  const normalized = normalizeTelegramHistoryInterval({
    chatId,
    endAt,
    startAt
  });
  return normalized.startAt < normalized.endAt ? [normalized] : [];
}

function parseObservedStartAt(value: unknown, reachedStart: boolean): Date | undefined {
  if (value === null && reachedStart) {
    return TELEGRAM_HISTORY_PAST_BOUNDARY;
  }
  return parseDate(value);
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
