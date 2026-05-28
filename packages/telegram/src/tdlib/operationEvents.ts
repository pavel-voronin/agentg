import { randomUUID } from 'node:crypto';

import type { EventBus } from '@agentg/events/bus';
import { createIntegrationEvent } from '@agentg/events/envelope';
import { toJsonValue } from '@agentg/events/json';

import type { TelegramTdlibPriority } from './priority.js';
import type { TelegramTdlibQueueStats } from './scheduler.js';

export type TdlibInvokeOptions = {
  priority?: TelegramTdlibPriority;
};

export type TdlibInvoker = {
  getQueueStats?(): TelegramTdlibQueueStats;
  invoke(request: Record<string, unknown>, options?: TdlibInvokeOptions): Promise<unknown>;
};

export async function invokeTdlibWithEvents(
  eventBus: EventBus,
  client: TdlibInvoker,
  request: Record<string, unknown>,
  options: TdlibInvokeOptions = {}
): Promise<unknown> {
  const method = tdlibMethodName(request._);
  return publishOperationEvents(
    eventBus,
    `telegram.tdlib.${sanitizeEventSegment(method)}`,
    method,
    {
      ...(options.priority === undefined ? {} : { priority: options.priority }),
      request
    },
    () => client.invoke(request, options)
  );
}

export async function publishTelegramOperationEvents<T>(
  eventBus: EventBus,
  operationName: string,
  input: unknown,
  operation: () => Promise<T>
): Promise<T> {
  return publishOperationEvents(
    eventBus,
    `telegram.${sanitizeEventSegment(operationName)}`,
    operationName,
    input,
    operation
  );
}

export async function publishTdlibOperationEvents<T>(
  eventBus: EventBus,
  method: string,
  input: unknown,
  operation: () => Promise<T>
): Promise<T> {
  return publishOperationEvents(
    eventBus,
    `telegram.tdlib.${sanitizeEventSegment(method)}`,
    method,
    input,
    operation
  );
}

async function publishOperationEvents<T>(
  eventBus: EventBus,
  target: string,
  method: string,
  input: unknown,
  operation: () => Promise<T>
): Promise<T> {
  const callId = `telegram_${randomUUID()}`;
  const startedAt = new Date();

  eventBus.publish(
    createIntegrationEvent({
      data: {
        callId,
        input: toJsonValue(input),
        method,
        startedAt: startedAt.toISOString()
      },
      type: `${target}.started`
    })
  );

  try {
    const result = await operation();
    const completedAt = new Date();
    eventBus.publish(
      createIntegrationEvent({
        data: {
          callId,
          completedAt: completedAt.toISOString(),
          durationMs: completedAt.getTime() - startedAt.getTime(),
          method,
          startedAt: startedAt.toISOString()
        },
        type: `${target}.completed`
      })
    );
    return result;
  } catch (error) {
    const failedAt = new Date();
    eventBus.publish(
      createIntegrationEvent({
        data: {
          callId,
          durationMs: failedAt.getTime() - startedAt.getTime(),
          error: {
            message: error instanceof Error ? error.message : String(error)
          },
          failedAt: failedAt.toISOString(),
          method,
          startedAt: startedAt.toISOString()
        },
        type: `${target}.failed`
      })
    );
    throw error;
  }
}

function tdlibMethodName(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : 'unknown';
}

function sanitizeEventSegment(method: string): string {
  return method.replace(/[^A-Za-z0-9_]/g, '_');
}
