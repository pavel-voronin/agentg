import type { HistoryInterval } from './types.js';

export const TELEGRAM_HISTORY_TICK_MS = 1000;

export function floorToTelegramSecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / TELEGRAM_HISTORY_TICK_MS) * TELEGRAM_HISTORY_TICK_MS);
}

export function ceilToTelegramSecond(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / TELEGRAM_HISTORY_TICK_MS) * TELEGRAM_HISTORY_TICK_MS);
}

export function normalizeTelegramHistoryInterval<T extends HistoryInterval>(interval: T): T {
  return {
    ...interval,
    endAt: ceilToTelegramSecond(interval.endAt),
    startAt: floorToTelegramSecond(interval.startAt)
  };
}
