import type { EventBus } from '../events/bus.js';
import { createIntegrationEvent, type IntegrationEvent } from '../events/envelope.js';
import type { JsonObject } from '../json.js';
import { toJsonValue } from '../json.js';
import type { DomainError } from './envelope.js';

export const RPC_CALL_STARTED_EVENT_SUFFIX = 'started';
export const RPC_CALL_PROGRESS_EVENT_SUFFIX = 'progress';
export const RPC_CALL_COMPLETED_EVENT_SUFFIX = 'completed';
export const RPC_CALL_FAILED_EVENT_SUFFIX = 'failed';

export type RpcCallEventSuffix =
  | typeof RPC_CALL_STARTED_EVENT_SUFFIX
  | typeof RPC_CALL_PROGRESS_EVENT_SUFFIX
  | typeof RPC_CALL_COMPLETED_EVENT_SUFFIX
  | typeof RPC_CALL_FAILED_EVENT_SUFFIX;

export type RpcProgressData = JsonObject;

export type RpcCallEventBase = {
  callId: string;
  input?: unknown;
  source: string;
  startedAt?: Date;
  target: string;
};

export type RpcCallStartedEventInput = RpcCallEventBase;

export type RpcCallProgressEventInput = RpcCallEventBase & {
  progress: RpcProgressData;
};

export type RpcCallCompletedEventInput = RpcCallEventBase & {
  output?: unknown;
};

export type RpcCallFailedEventInput = RpcCallEventBase & {
  error: DomainError;
  output?: unknown;
};

export function createRpcCallStartedEvent(input: RpcCallStartedEventInput): IntegrationEvent {
  const occurredAt = input.startedAt ?? new Date();

  return createIntegrationEvent({
    data: {
      callId: input.callId,
      startedAt: occurredAt.toISOString(),
      target: input.target,
      ...(input.input === undefined ? {} : { input: toJsonValue(input.input) })
    },
    occurredAt,
    source: input.source,
    type: rpcCallEventType(input.target, RPC_CALL_STARTED_EVENT_SUFFIX)
  });
}

export function createRpcCallProgressEvent(input: RpcCallProgressEventInput): IntegrationEvent {
  const occurredAt = new Date();

  return createIntegrationEvent({
    data: {
      callId: input.callId,
      progress: toJsonValue(input.progress),
      progressAt: occurredAt.toISOString(),
      target: input.target,
      ...(input.input === undefined ? {} : { input: toJsonValue(input.input) }),
      ...(input.startedAt === undefined ? {} : { startedAt: input.startedAt.toISOString() })
    },
    occurredAt,
    source: input.source,
    type: rpcCallEventType(input.target, RPC_CALL_PROGRESS_EVENT_SUFFIX)
  });
}

export function createRpcCallCompletedEvent(input: RpcCallCompletedEventInput): IntegrationEvent {
  const occurredAt = new Date();

  return createIntegrationEvent({
    data: {
      callId: input.callId,
      completedAt: occurredAt.toISOString(),
      target: input.target,
      ...(input.input === undefined ? {} : { input: toJsonValue(input.input) }),
      ...(input.output === undefined ? {} : { output: toJsonValue(input.output) }),
      ...(input.startedAt === undefined ? {} : { startedAt: input.startedAt.toISOString() })
    },
    occurredAt,
    source: input.source,
    type: rpcCallEventType(input.target, RPC_CALL_COMPLETED_EVENT_SUFFIX)
  });
}

export function createRpcCallFailedEvent(input: RpcCallFailedEventInput): IntegrationEvent {
  const occurredAt = new Date();

  return createIntegrationEvent({
    data: {
      callId: input.callId,
      error: toJsonValue(input.error),
      failedAt: occurredAt.toISOString(),
      target: input.target,
      ...(input.input === undefined ? {} : { input: toJsonValue(input.input) }),
      ...(input.output === undefined ? {} : { output: toJsonValue(input.output) }),
      ...(input.startedAt === undefined ? {} : { startedAt: input.startedAt.toISOString() })
    },
    occurredAt,
    source: input.source,
    type: rpcCallEventType(input.target, RPC_CALL_FAILED_EVENT_SUFFIX)
  });
}

export function rpcCallEventType(target: string, suffix: RpcCallEventSuffix): string {
  return `${target}.${suffix}`;
}

export function publishRpcCallEvent(eventBus: EventBus | undefined, event: IntegrationEvent): void {
  if (eventBus === undefined) {
    return;
  }

  try {
    eventBus.publish(event);
  } catch (error) {
    console.error(
      JSON.stringify({
        callId: event.data.callId,
        error: error instanceof Error ? error.message : String(error),
        event: 'rpc.call_event_publish_failed',
        rpcEventType: event.type,
        target: event.data.target
      })
    );
  }
}

export function errorFromUnknown(error: unknown): DomainError {
  if (error instanceof Error) {
    return {
      code: 'internal_error',
      message: error.message
    };
  }

  return {
    code: 'internal_error',
    message: String(error)
  };
}
