import {
  ceilToTelegramSecond,
  floorToTelegramSecond,
  normalizeTelegramHistoryInterval
} from './time.js';
import type { HistorySyncBoundary, HistorySyncInterval, HistorySyncRange } from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const SECOND_MS = 1000;
const WEEK_MS = 7 * DAY_MS;
const DURATION_UNIT_ORDER = ['y', 'mo', 'w', 'd', 'h', 'm', 's'] as const;

export type HistorySyncRangeProjectionContext = {
  literals?: Record<string, Date>;
  now: Date;
};

export function absoluteBoundary(at: Date | string): HistorySyncBoundary {
  const date = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid absolute history boundary: ${String(at)}`);
  }

  return {
    at: date.toISOString(),
    kind: 'absolute'
  };
}

export function expressionBoundary(expression: string): HistorySyncBoundary {
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    throw new Error('History Sync boundary expression cannot be empty');
  }

  return {
    expression: trimmed,
    kind: 'expression'
  };
}

export function historySyncRange(
  start: HistorySyncBoundary,
  end: HistorySyncBoundary
): HistorySyncRange {
  return { end, start };
}

export function canonicalizeHistorySyncRange(range: HistorySyncRange): HistorySyncRange {
  return {
    end: canonicalizeBoundary(range.end, 'end'),
    start: canonicalizeBoundary(range.start, 'start')
  };
}

export function projectHistorySyncRange(
  range: HistorySyncRange,
  context: HistorySyncRangeProjectionContext
): HistorySyncInterval {
  const interval = normalizeTelegramHistoryInterval({
    endAt: resolveBoundary(range.end, context),
    startAt: resolveBoundary(range.start, context)
  });

  if (interval.startAt >= interval.endAt) {
    throw new Error('History Sync range start must be before end');
  }

  return interval;
}

export function mergeIntervals(intervals: HistorySyncInterval[]): HistorySyncInterval[] {
  const sorted = intervals
    .filter((interval) => interval.startAt < interval.endAt)
    .map(cloneInterval)
    .sort(compareIntervalStart);

  const merged: HistorySyncInterval[] = [];
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
  desiredIntervals: HistorySyncInterval[],
  coverageIntervals: HistorySyncInterval[]
): HistorySyncInterval[] {
  const desired = mergeIntervals(desiredIntervals);
  const coverage = mergeIntervals(coverageIntervals);
  const missing: HistorySyncInterval[] = [];

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
  intervals: HistorySyncInterval[],
  windowMilliseconds: number
): HistorySyncInterval[] {
  if (!Number.isSafeInteger(windowMilliseconds) || windowMilliseconds <= 0) {
    throw new Error('windowMilliseconds must be a positive safe integer');
  }

  const chunks: HistorySyncInterval[] = [];
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

export function orderIntervalsClosestToPresent(
  intervals: HistorySyncInterval[]
): HistorySyncInterval[] {
  return [...intervals].sort((first, second) => {
    const endDifference = second.endAt.getTime() - first.endAt.getTime();
    return endDifference === 0 ? second.startAt.getTime() - first.startAt.getTime() : endDifference;
  });
}

export function sameHistorySyncRange(first: HistorySyncRange, second: HistorySyncRange): boolean {
  return historySyncRangeKey(first) === historySyncRangeKey(second);
}

export function historySyncRangeKey(range: HistorySyncRange): string {
  return JSON.stringify(canonicalizeHistorySyncRange(range));
}

function canonicalizeBoundary(
  boundary: HistorySyncBoundary,
  edge: 'end' | 'start'
): HistorySyncBoundary {
  if (boundary.kind === 'absolute') {
    const date = parseDateBoundary(boundary.at);
    return absoluteBoundary(
      edge === 'start' ? floorToTelegramSecond(date) : ceilToTelegramSecond(date)
    );
  }

  return expressionBoundary(boundary.expression);
}

function resolveBoundary(
  boundary: HistorySyncBoundary,
  context: HistorySyncRangeProjectionContext
): Date {
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

  const relativeDate = resolveRelativeExpression(expression, context);
  if (relativeDate !== undefined) {
    return relativeDate;
  }

  return parseDateBoundary(expression);
}

function resolveRelativeExpression(
  expression: string,
  context: HistorySyncRangeProjectionContext
): Date | undefined {
  const compact = expression.replace(/\s+/g, '');
  const base = relativeExpressionBase(compact, context);
  if (base === undefined) {
    return undefined;
  }

  let date = new Date(base.date);
  let offset = base.expression.length;
  const operationPattern = /([+-])([^+-]+)/g;
  operationPattern.lastIndex = offset;
  for (;;) {
    const operation = operationPattern.exec(compact);
    if (operation === null) {
      break;
    }
    if (operation.index !== offset || operation[1] === undefined || operation[2] === undefined) {
      return undefined;
    }
    const duration = parseDuration(operation[2]);
    if (duration === undefined) {
      return undefined;
    }
    date = applyDuration(date, duration, operation[1] === '+' ? 1 : -1);
    offset = operation.index + operation[0].length;
  }

  return offset === compact.length && offset > base.expression.length ? date : undefined;
}

function relativeExpressionBase(
  expression: string,
  context: HistorySyncRangeProjectionContext
): { date: Date; expression: string } | undefined {
  const candidates = [
    { date: context.now, expression: 'now' },
    ...Object.entries(context.literals ?? {}).map(([literal, date]) => ({
      date,
      expression: literal
    }))
  ].sort((left, right) => right.expression.length - left.expression.length);

  return candidates.find(
    (candidate) =>
      expression.startsWith(candidate.expression) &&
      ['+', '-'].includes(expression[candidate.expression.length] ?? '')
  );
}

function applyDuration(
  date: Date,
  duration: {
    d: number;
    h: number;
    m: number;
    mo: number;
    s: number;
    w: number;
    y: number;
  },
  direction: -1 | 1
): Date {
  const shifted = shiftCalendarDuration(date, direction * duration.y, direction * duration.mo);
  const fixedMilliseconds =
    duration.w * WEEK_MS +
    duration.d * DAY_MS +
    duration.h * HOUR_MS +
    duration.m * MINUTE_MS +
    duration.s * SECOND_MS;
  return new Date(shifted.getTime() + direction * fixedMilliseconds);
}

function parseDuration(value: string):
  | {
      d: number;
      h: number;
      m: number;
      mo: number;
      s: number;
      w: number;
      y: number;
    }
  | undefined {
  const compact = value.replace(/\s+/g, '');
  if (compact.length === 0) {
    return undefined;
  }

  const duration = { d: 0, h: 0, m: 0, mo: 0, s: 0, w: 0, y: 0 };
  let offset = 0;
  let previousOrder = -1;
  const tokenPattern = /(\d+)(y|mo|w|d|h|m|s)/g;
  for (;;) {
    const token = tokenPattern.exec(compact);
    if (token === null) {
      break;
    }
    if (token.index !== offset || token[1] === undefined || token[2] === undefined) {
      return undefined;
    }
    const unit = token[2] as keyof typeof duration;
    const order = DURATION_UNIT_ORDER.indexOf(unit);
    const amount = Number.parseInt(token[1], 10);
    if (!Number.isSafeInteger(amount) || amount <= 0 || order <= previousOrder) {
      return undefined;
    }
    duration[unit] = amount;
    previousOrder = order;
    offset = token.index + token[0].length;
  }

  return offset === compact.length && offset > 0 ? duration : undefined;
}

function shiftCalendarDuration(date: Date, years: number, months: number): Date {
  if (years === 0 && months === 0) {
    return new Date(date);
  }

  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + years * 12 + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = totalMonths - targetYear * 12;
  const targetDay = Math.min(date.getUTCDate(), daysInUtcMonth(targetYear, targetMonth));
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function parseDateBoundary(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Unknown history boundary expression: ${value}`);
  }

  return date;
}

function cloneInterval(interval: HistorySyncInterval): HistorySyncInterval {
  return {
    endAt: new Date(interval.endAt),
    startAt: new Date(interval.startAt)
  };
}

function compareIntervalStart(first: HistorySyncInterval, second: HistorySyncInterval): number {
  const startDifference = first.startAt.getTime() - second.startAt.getTime();
  return startDifference === 0 ? first.endAt.getTime() - second.endAt.getTime() : startDifference;
}

function maxDate(first: Date, second: Date): Date {
  return first > second ? first : second;
}

function minDate(first: Date, second: Date): Date {
  return first < second ? first : second;
}
