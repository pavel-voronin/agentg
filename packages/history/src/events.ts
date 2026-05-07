import type { JsonObject } from '@agentg/events/json';

import { normalizeCoverageIntervals } from './coverage.js';
import type { BackfillJob, HistoryCoverageInterval } from './types.js';

export type HistoryCoverageChangedEventInterval = {
  chatId: string;
  endAt: string;
  startAt: string;
};

export function historyCoverageChangedData(intervals: HistoryCoverageInterval[]): JsonObject {
  const eventIntervals = normalizeCoverageIntervals(intervals).map((interval) => ({
    chatId: interval.chatId,
    endAt: interval.endAt.toISOString(),
    startAt: interval.startAt.toISOString()
  }));
  const startAt = minIso(eventIntervals.map((interval) => interval.startAt));
  const endAt = maxIso(eventIntervals.map((interval) => interval.endAt));

  return {
    ...(eventIntervals.length === 1 && eventIntervals[0] !== undefined
      ? { chatId: eventIntervals[0].chatId }
      : {}),
    chatCount: new Set(eventIntervals.map((interval) => interval.chatId)).size,
    endAt,
    intervals: eventIntervals,
    startAt
  };
}

export function historyJobEventData(job: BackfillJob): JsonObject {
  return {
    chatId: job.chatId,
    jobEnd: job.endAt.toISOString(),
    jobId: job.id,
    jobStart: job.startAt.toISOString()
  };
}

function minIso(values: string[]): string {
  const [first, ...rest] = values;
  if (first === undefined) {
    throw new Error('history.coverage.changed requires at least one interval');
  }
  return rest.reduce((minimum, value) => (value < minimum ? value : minimum), first);
}

function maxIso(values: string[]): string {
  const [first, ...rest] = values;
  if (first === undefined) {
    throw new Error('history.coverage.changed requires at least one interval');
  }
  return rest.reduce((maximum, value) => (value > maximum ? value : maximum), first);
}
