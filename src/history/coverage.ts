import { mergeIntervals, normalizeHistoryInterval, TELEGRAM_HISTORY_TICK_MS } from './ranges.js';
import type { HistoryInterval } from './ranges.js';

export type HistoryCoverageInterval = HistoryInterval & {
  chatId: string;
  source: 'backfill' | 'live';
};

export function addCoverageInterval(
  intervals: HistoryCoverageInterval[],
  interval: HistoryCoverageInterval
): HistoryCoverageInterval[] {
  return normalizeCoverageIntervals([...intervals, interval]);
}

export function normalizeCoverageIntervals(
  intervals: HistoryCoverageInterval[]
): HistoryCoverageInterval[] {
  const chatIds = [...new Set(intervals.map((interval) => interval.chatId))].sort();

  return chatIds.flatMap((chatId) => {
    const normalized = intervals
      .filter((interval) => interval.chatId === chatId)
      .map(normalizeHistoryInterval);

    const source = normalized.some((interval) => interval.source === 'backfill')
      ? 'backfill'
      : 'live';

    return mergeCoverageIntervals(normalized).map((interval) => ({
      ...interval,
      chatId,
      source
    }));
  });
}

export function liveMessageCoverageInterval(input: {
  chatId: string;
  messageDate: Date;
  observedUntil: Date;
}): HistoryCoverageInterval {
  const normalized = normalizeHistoryInterval({
    endAt: input.observedUntil,
    startAt: input.messageDate
  });

  return {
    ...normalized,
    chatId: input.chatId,
    endAt:
      normalized.endAt <= normalized.startAt
        ? new Date(normalized.startAt.getTime() + TELEGRAM_HISTORY_TICK_MS)
        : normalized.endAt,
    source: 'live'
  };
}

function mergeCoverageIntervals(intervals: HistoryCoverageInterval[]): HistoryInterval[] {
  const sorted = mergeIntervals(intervals).sort(
    (first, second) => first.startAt.getTime() - second.startAt.getTime()
  );
  const merged: HistoryInterval[] = [];

  for (const interval of sorted) {
    const last = merged.at(-1);
    if (
      last === undefined ||
      interval.startAt.getTime() > last.endAt.getTime() + TELEGRAM_HISTORY_TICK_MS
    ) {
      merged.push({ ...interval });
      continue;
    }

    if (interval.endAt > last.endAt) {
      last.endAt = interval.endAt;
    }
  }

  return merged;
}
