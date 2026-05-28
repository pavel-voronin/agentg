export type TelegramHistoryInterval = {
  endAt: Date;
  startAt: Date;
};

export const TELEGRAM_HISTORY_TICK_MS = 1000;
export const TELEGRAM_HISTORY_PAST_BOUNDARY = new Date('2013-08-14T00:00:00.000Z');

export function floorToTelegramSecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / TELEGRAM_HISTORY_TICK_MS) * TELEGRAM_HISTORY_TICK_MS);
}

export function ceilToTelegramSecond(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / TELEGRAM_HISTORY_TICK_MS) * TELEGRAM_HISTORY_TICK_MS);
}

export function normalizeTelegramHistoryInterval<T extends TelegramHistoryInterval>(
  interval: T
): T {
  return {
    ...interval,
    endAt: ceilToTelegramSecond(interval.endAt),
    startAt: floorToTelegramSecond(interval.startAt)
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
