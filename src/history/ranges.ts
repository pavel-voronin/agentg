export type HistoryInterval = {
  endAt: Date;
  startAt: Date;
};

export const TELEGRAM_HISTORY_TICK_MS = 1000;

export function normalizeHistoryInterval<T extends HistoryInterval>(interval: T): T {
  const normalized = {
    ...interval,
    endAt: ceilToTelegramSecond(interval.endAt),
    startAt: floorToTelegramSecond(interval.startAt)
  };

  if (normalized.startAt >= normalized.endAt) {
    throw new Error('History interval start must be before end');
  }

  return normalized;
}

export function mergeIntervals(intervals: HistoryInterval[]): HistoryInterval[] {
  const sorted = intervals
    .filter((interval) => interval.startAt < interval.endAt)
    .map((interval) => ({ ...interval }))
    .sort((first, second) => first.startAt.getTime() - second.startAt.getTime());

  const merged: HistoryInterval[] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last === undefined || interval.startAt > last.endAt) {
      merged.push(interval);
      continue;
    }

    if (interval.endAt > last.endAt) {
      last.endAt = interval.endAt;
    }
  }

  return merged;
}

export function subtractIntervals(
  desiredIntervals: HistoryInterval[],
  coverageIntervals: HistoryInterval[]
): HistoryInterval[] {
  const desired = mergeIntervals(desiredIntervals);
  const coverage = mergeIntervals(coverageIntervals);
  const missing: HistoryInterval[] = [];

  for (const desiredInterval of desired) {
    let cursor = desiredInterval.startAt;

    for (const coveredInterval of coverage) {
      if (coveredInterval.endAt <= cursor) {
        continue;
      }
      if (coveredInterval.startAt >= desiredInterval.endAt) {
        break;
      }
      if (coveredInterval.startAt > cursor) {
        missing.push({
          endAt: minDate(coveredInterval.startAt, desiredInterval.endAt),
          startAt: cursor
        });
      }
      if (coveredInterval.endAt > cursor) {
        cursor = maxDate(cursor, coveredInterval.endAt);
      }
      if (cursor >= desiredInterval.endAt) {
        break;
      }
    }

    if (cursor < desiredInterval.endAt) {
      missing.push({
        endAt: desiredInterval.endAt,
        startAt: cursor
      });
    }
  }

  return missing;
}

export function splitIntervals(
  intervals: HistoryInterval[],
  windowMilliseconds: number
): HistoryInterval[] {
  if (!Number.isSafeInteger(windowMilliseconds) || windowMilliseconds <= 0) {
    throw new Error('windowMilliseconds must be a positive safe integer');
  }

  const chunks: HistoryInterval[] = [];
  for (const interval of intervals) {
    let endAt = interval.endAt;
    while (interval.startAt < endAt) {
      const startAt = maxDate(interval.startAt, new Date(endAt.getTime() - windowMilliseconds));
      chunks.push({ endAt, startAt });
      endAt = startAt;
    }
  }

  return chunks.sort((first, second) => second.endAt.getTime() - first.endAt.getTime());
}

export function floorToTelegramSecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / TELEGRAM_HISTORY_TICK_MS) * TELEGRAM_HISTORY_TICK_MS);
}

export function ceilToTelegramSecond(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / TELEGRAM_HISTORY_TICK_MS) * TELEGRAM_HISTORY_TICK_MS);
}

function minDate(first: Date, second: Date): Date {
  return first < second ? first : second;
}

function maxDate(first: Date, second: Date): Date {
  return first > second ? first : second;
}
