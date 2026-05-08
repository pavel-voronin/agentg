import type { EventBus } from '@agentg/events/bus';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/events/envelope';
import type { JsonObject, JsonValue } from '@agentg/events/json';
import { toJsonValue } from '@agentg/events/json';
import {
  RPC_CALL_COMPLETED_EVENT_SUFFIX,
  RPC_CALL_FAILED_EVENT_SUFFIX,
  RPC_CALL_PROGRESS_EVENT_SUFFIX,
  RPC_CALL_STARTED_EVENT_SUFFIX,
  rpcCallEventType
} from './call-event-types.js';

export {
  RPC_CALL_COMPLETED_EVENT_SUFFIX,
  RPC_CALL_EVENT_CATEGORY,
  RPC_CALL_EVENT_LIFECYCLES,
  RPC_CALL_FAILED_EVENT_SUFFIX,
  RPC_CALL_PROGRESS_EVENT_SUFFIX,
  RPC_CALL_STARTED_EVENT_SUFFIX,
  rpcCallEventTarget,
  rpcCallEventTypesForProcedure,
  rpcCallEventType
} from './call-event-types.js';
export type { RpcCallEventSuffix, RpcEventManifest } from './call-event-types.js';

export type RpcProgressData = JsonObject;

export type RpcCallError = {
  code: string;
  details?: JsonValue | undefined;
  message: string;
};

export type RpcCallEventBase = {
  callId: string;
  input?: unknown;
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
  error: RpcCallError;
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
    type: rpcCallEventType(input.target, RPC_CALL_FAILED_EVENT_SUFFIX)
  });
}

export function publishRpcCallEvent(eventBus: EventBus | undefined, event: IntegrationEvent): void {
  if (eventBus === undefined) {
    return;
  }

  eventBus.publish(event);
}

export function errorFromUnknown(error: unknown): RpcCallError {
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
