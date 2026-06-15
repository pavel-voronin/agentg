import { z } from 'zod';

export const nonEmptyStringSchema = z.string().trim().min(1);
export const nonNegativeIntegerSchema = z.number().int().nonnegative();
export const positiveIntegerSchema = z.number().int().positive();
export const isoDateTimeStringSchema = z.iso.datetime();

export type DateLike = Date | number | string;

export function toDate(value: DateLike | null): Date | null {
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

export function toNullableIsoString(value: DateLike | null): string | null {
  return toDate(value)?.toISOString() ?? null;
}
