export const priorities = {
  high: 24,
  low: 8,
  maximum: 32,
  normal: 16
} as const;

export type Priority = number;

export function resolvePriority(priority: Priority | undefined, fallback: Priority): number {
  if (priority === undefined) {
    return fallback;
  }
  return assertPriority(priority);
}

export function assertPriority(priority: number): number {
  if (Number.isSafeInteger(priority) && priority >= 1 && priority <= 32) {
    return priority;
  }
  throw new Error(`TDLib priority must be an integer from 1 to 32: ${String(priority)}`);
}
