import { mergeIntervals } from './ranges.js';
import { normalizeTelegramHistoryInterval, TELEGRAM_HISTORY_TICK_MS } from './time.js';
import type { HistoryCoverageInterval, HistoryInterval } from './types.js';

export type AcceptedLiveUpdate =
  | {
      chatId: string;
      kind: 'message-history';
      messageDate: Date;
      observedUntil: Date;
    }
  | {
      kind: 'non-message';
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
  const chatIds = [...new Set(intervals.map((existing) => existing.chatId))].sort();

  return chatIds.flatMap((chatId) => {
    const normalized = intervals
      .filter((existing) => existing.chatId === chatId)
      .map(normalizeTelegramHistoryInterval);

    return mergeCoverageIntervals(normalized).map((mergedInterval) => ({
      ...mergedInterval,
      chatId
    }));
  });
}

export function addCoverageFromLiveUpdate(
  intervals: HistoryCoverageInterval[],
  update: AcceptedLiveUpdate
): HistoryCoverageInterval[] {
  if (update.kind !== 'message-history' || update.messageDate > update.observedUntil) {
    return intervals;
  }

  return addCoverageInterval(intervals, liveMessageCoverageInterval(update));
}

export function coverageForChat(
  intervals: HistoryCoverageInterval[],
  chatId: string
): HistoryCoverageInterval[] {
  return normalizeCoverageIntervals(intervals).filter((interval) => interval.chatId === chatId);
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

export function liveMessageCoverageInterval(update: {
  chatId: string;
  messageDate: Date;
  observedUntil: Date;
}): HistoryCoverageInterval {
  const normalized = normalizeTelegramHistoryInterval({
    chatId: update.chatId,
    endAt: update.observedUntil,
    startAt: update.messageDate
  });

  return {
    ...normalized,
    endAt:
      normalized.endAt <= normalized.startAt
        ? new Date(normalized.startAt.getTime() + TELEGRAM_HISTORY_TICK_MS)
        : normalized.endAt
  };
}
