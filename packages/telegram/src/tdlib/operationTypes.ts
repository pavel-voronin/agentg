import type { Priority } from './priority.js';

export type InvokeOptions = {
  priority?: Priority;
  timeoutMs?: number;
};

export type QueueStats = {
  highestPendingPriority: number | null;
  pendingCount: number;
  runningCount: number;
};

export type Invoker = {
  getQueueStats?(): QueueStats;
  invoke(request: Record<string, unknown>, options?: InvokeOptions): Promise<unknown>;
};
