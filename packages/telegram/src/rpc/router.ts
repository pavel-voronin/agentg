import { telegramRpcSurface } from './surface.js';
import { telegramRpcRouter } from './trpc.js';
import type { TelegramRpcRuntime } from './runtime.js';

export type { TelegramRpcRuntime } from './runtime.js';

export function createTelegramRouter(runtime: TelegramRpcRuntime) {
  return telegramRpcRouter(telegramRpcSurface.router(runtime));
}

export type TelegramRouter = ReturnType<typeof createTelegramRouter>;
