import { historyRpcSurface } from './surface.js';
import { historyRpcRouter } from './trpc.js';
import type { CreateHistoryRouterOptions } from './runtime.js';

export type { CreateHistoryRouterOptions, HistoryRuntime } from './runtime.js';

export function createHistoryRouter(options: CreateHistoryRouterOptions) {
  return historyRpcRouter(historyRpcSurface.router(options));
}

export type HistoryRouter = ReturnType<typeof createHistoryRouter>;
