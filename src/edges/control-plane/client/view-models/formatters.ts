export function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16).replace('T', ' ');
}

export function formatEventTime(value: Date | string | undefined): string {
  const date = value instanceof Date ? value : new Date(value ?? '');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString();
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

export function formatOptionalValue(value: Date | number | string | undefined): string {
  return value === undefined ? '' : String(value);
}
