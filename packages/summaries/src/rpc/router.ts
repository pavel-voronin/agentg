import { summariesRpcSurface } from './surface.js';
import { summariesRpcRouter } from './trpc.js';
import type { SummariesRuntime } from '../runtime.js';

export function createSummariesRouter(runtime: SummariesRuntime) {
  return summariesRpcRouter(summariesRpcSurface.router(runtime));
}

export type SummariesRouter = ReturnType<typeof createSummariesRouter>;
