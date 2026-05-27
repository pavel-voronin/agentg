export function requireDate(value: unknown, message: string): Date {
  const text = requireString(value, message);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new Error(message);
  }
  return date;
}

export function parseLimit(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return fallback;
  }

  return Math.min(value, max);
}

function requireString(value: unknown, message: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  throw new Error(message);
}
