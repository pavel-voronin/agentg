import { historySyncRpcSurface } from './surface.js';
import { historySyncRpcRouter } from './trpc.js';
import type { CreateHistorySyncRouterOptions } from './runtime.js';

export type { CreateHistorySyncRouterOptions, HistorySyncRuntime } from './runtime.js';

export function createHistorySyncRouter(options: CreateHistorySyncRouterOptions) {
  return historySyncRpcRouter(historySyncRpcSurface.router(options));
}

export type HistorySyncRouter = ReturnType<typeof createHistorySyncRouter>;
