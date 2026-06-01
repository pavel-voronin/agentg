export type HistoryInterval = {
  endAt: Date;
  startAt: Date;
};

export const HISTORY_TICK_MS = 1000;
export const HISTORY_PAST_BOUNDARY = new Date('2013-08-14T00:00:00.000Z');

export function floorToHistorySecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / HISTORY_TICK_MS) * HISTORY_TICK_MS);
}

export function ceilToHistorySecond(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / HISTORY_TICK_MS) * HISTORY_TICK_MS);
}

export function normalizeHistoryInterval<T extends HistoryInterval>(interval: T): T {
  return {
    ...interval,
    endAt: ceilToHistorySecond(interval.endAt),
    startAt: floorToHistorySecond(interval.startAt)
  };
}

export function requireDate(value: unknown, message: string): Date {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }

  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    throw new Error(message);
  }

  return date;
}
