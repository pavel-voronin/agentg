import { telegramRpcSurface } from './surface.js';
import { telegramRpcRouter } from './trpc.js';
import { createTelegramRpcRuntime, type TelegramRpcRuntimeDeps } from './runtime.js';

export type { TelegramRpcRuntime, TelegramRpcRuntimeDeps } from './runtime.js';

export function createTelegramRouter(deps: TelegramRpcRuntimeDeps) {
  const runtime = createTelegramRpcRuntime(deps);
  return telegramRpcRouter(telegramRpcSurface.router(runtime));
}

export type TelegramRouter = ReturnType<typeof createTelegramRouter>;
