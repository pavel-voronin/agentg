export const telegramTdlibPriorities = {
  p0: 500,
  p1: 400,
  p2: 300,
  p3: 200,
  p4: 100
} as const;

export type TelegramTdlibPriority = keyof typeof telegramTdlibPriorities;

export function resolveTelegramTdlibPriority(
  priority: TelegramTdlibPriority | number | undefined,
  fallback: TelegramTdlibPriority
): number {
  if (typeof priority === 'number') {
    return Number.isFinite(priority) ? priority : telegramTdlibPriorities[fallback];
  }
  if (priority === undefined) {
    return telegramTdlibPriorities[fallback];
  }
  return telegramTdlibPriorities[priority];
}
