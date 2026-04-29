import { normalizeTelegramHistoryInterval } from './time.js';
import type { HistoryBoundary, HistoryInterval, HistoryRange } from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export type HistoryRangeProjectionContext = {
  literals?: Record<string, Date>;
  now: Date;
};

export function absoluteBoundary(at: Date | string): HistoryBoundary {
  const date = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid absolute history boundary: ${String(at)}`);
  }

  return {
    at: date.toISOString(),
    kind: 'absolute'
  };
}

export function expressionBoundary(expression: string): HistoryBoundary {
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    throw new Error('History boundary expression cannot be empty');
  }

  return {
    expression: trimmed,
    kind: 'expression'
  };
}

export function historyRange(start: HistoryBoundary, end: HistoryBoundary): HistoryRange {
  return { end, start };
}

export function canonicalizeHistoryRange(range: HistoryRange): HistoryRange {
  return {
    end: canonicalizeBoundary(range.end),
    start: canonicalizeBoundary(range.start)
  };
}

export function projectHistoryRange(
  range: HistoryRange,
  context: HistoryRangeProjectionContext
): HistoryInterval {
  const interval = normalizeTelegramHistoryInterval({
    endAt: resolveBoundary(range.end, context),
    startAt: resolveBoundary(range.start, context)
  });

  if (interval.startAt >= interval.endAt) {
    throw new Error('History range start must be before end');
  }

  return interval;
}

export function mergeIntervals(intervals: HistoryInterval[]): HistoryInterval[] {
  const sorted = intervals
    .filter((interval) => interval.startAt < interval.endAt)
    .map(cloneInterval)
    .sort(compareIntervalStart);

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

  return orderIntervalsClosestToPresent(chunks);
}

export function orderIntervalsClosestToPresent(intervals: HistoryInterval[]): HistoryInterval[] {
  return [...intervals].sort((first, second) => {
    const endDifference = second.endAt.getTime() - first.endAt.getTime();
    return endDifference === 0 ? second.startAt.getTime() - first.startAt.getTime() : endDifference;
  });
}

export function sameHistoryRange(first: HistoryRange, second: HistoryRange): boolean {
  return historyRangeKey(first) === historyRangeKey(second);
}

export function historyRangeKey(range: HistoryRange): string {
  return JSON.stringify(canonicalizeHistoryRange(range));
}

function canonicalizeBoundary(boundary: HistoryBoundary): HistoryBoundary {
  if (boundary.kind === 'absolute') {
    return absoluteBoundary(boundary.at);
  }

  return expressionBoundary(boundary.expression);
}

function resolveBoundary(boundary: HistoryBoundary, context: HistoryRangeProjectionContext): Date {
  if (boundary.kind === 'absolute') {
    return parseDateBoundary(boundary.at);
  }

  const expression = boundary.expression.trim();
  const literal = context.literals?.[expression];
  if (literal !== undefined) {
    return literal;
  }

  if (expression === 'now') {
    return context.now;
  }

  const nowMinusDays = /^now-(\d+)d$/.exec(expression);
  if (nowMinusDays?.[1] !== undefined) {
    return new Date(context.now.getTime() - Number.parseInt(nowMinusDays[1], 10) * DAY_MS);
  }

  return parseDateBoundary(expression);
}

function parseDateBoundary(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Unknown history boundary expression: ${value}`);
  }

  return date;
}

function cloneInterval(interval: HistoryInterval): HistoryInterval {
  return {
    endAt: new Date(interval.endAt),
    startAt: new Date(interval.startAt)
  };
}

function compareIntervalStart(first: HistoryInterval, second: HistoryInterval): number {
  const startDifference = first.startAt.getTime() - second.startAt.getTime();
  return startDifference === 0 ? first.endAt.getTime() - second.endAt.getTime() : startDifference;
}

function maxDate(first: Date, second: Date): Date {
  return first > second ? first : second;
}

function minDate(first: Date, second: Date): Date {
  return first < second ? first : second;
}
