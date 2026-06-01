import { randomUUID } from 'node:crypto';

import type { EventBus } from '@agentg/framework';
import { toJsonValue } from '@agentg/framework';

import type { Priority } from './priority.js';
import type { QueueStats } from './scheduler.js';

export type InvokeOptions = {
  priority?: Priority;
};

export type Invoker = {
  getQueueStats?(): QueueStats;
  invoke(request: Record<string, unknown>, options?: InvokeOptions): Promise<unknown>;
};

export async function invokeWithEvents(
  events: EventBus,
  client: Invoker,
  request: Record<string, unknown>,
  options: InvokeOptions = {}
): Promise<unknown> {
  const method = methodName(request._);
  return publishOperationEvents(
    events,
    `telegram.tdlib.${sanitizeEventSegment(method)}`,
    method,
    {
      ...(options.priority === undefined ? {} : { priority: options.priority }),
      request
    },
    () => client.invoke(request, options)
  );
}

export async function publishOperation<T>(
  events: EventBus,
  operationName: string,
  input: unknown,
  operation: () => Promise<T>
): Promise<T> {
  return publishOperationEvents(
    events,
    `telegram.${sanitizeEventSegment(operationName)}`,
    operationName,
    input,
    operation
  );
}

async function publishOperationEvents<T>(
  events: EventBus,
  target: string,
  method: string,
  input: unknown,
  operation: () => Promise<T>
): Promise<T> {
  const callId = `telegram_${randomUUID()}`;
  const startedAt = new Date();

  events.publish(`${target}.started`, {
    callId,
    input: toJsonValue(input),
    method,
    startedAt: startedAt.toISOString()
  });

  try {
    const result = await operation();
    const completedAt = new Date();
    events.publish(`${target}.completed`, {
      callId,
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      method,
      startedAt: startedAt.toISOString()
    });
    return result;
  } catch (error) {
    const failedAt = new Date();
    events.publish(`${target}.failed`, {
      callId,
      durationMs: failedAt.getTime() - startedAt.getTime(),
      error: {
        message: error instanceof Error ? error.message : String(error)
      },
      failedAt: failedAt.toISOString(),
      method,
      startedAt: startedAt.toISOString()
    });
    throw error;
  }
}

function methodName(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : 'unknown';
}

function sanitizeEventSegment(method: string): string {
  return method.replace(/[^A-Za-z0-9_]/g, '_');
}
