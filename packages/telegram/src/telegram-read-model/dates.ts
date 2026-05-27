export type TelegramDateLike = Date | number | string;

export function toTelegramDate(value: TelegramDateLike | null): Date | null {
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }

  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Telegram date value: ${String(value)}`);
  }
  return date;
}

export function toNullableIsoString(value: TelegramDateLike | null): string | null {
  return toTelegramDate(value)?.toISOString() ?? null;
}
