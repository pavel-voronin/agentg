export const telegramTdlibPriorities = {
  high: 24,
  low: 8,
  maximum: 32,
  normal: 16
} as const;

export type TelegramTdlibPriority = number;

export function resolveTelegramTdlibPriority(
  priority: TelegramTdlibPriority | undefined,
  fallback: TelegramTdlibPriority
): number {
  if (priority === undefined) {
    return fallback;
  }
  return assertTelegramTdlibPriority(priority);
}

export function assertTelegramTdlibPriority(priority: number): number {
  if (Number.isSafeInteger(priority) && priority >= 1 && priority <= 32) {
    return priority;
  }
  throw new Error(`TDLib priority must be an integer from 1 to 32: ${String(priority)}`);
}
