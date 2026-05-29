import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import type { EventBus } from '@agentg/events/bus';
import { initTRPC } from '@trpc/server';
import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone';
import { treeifyError, ZodError } from 'zod';

import {
  createInternalRpcCallOptionsResolver,
  eventBusForInternalRpcCall,
  INTERNAL_RPC_CALL_OPTIONS_HEADER,
  shouldPublishInternalRpcLifecycle,
  type InternalRpcCallOptions
} from './callOptions.js';
import {
  createRpcCallCompletedEvent,
  createRpcCallFailedEvent,
  createRpcCallProgressEvent,
  createRpcCallStartedEvent,
  errorFromUnknown,
  publishRpcCallEvent,
  type RpcProgressData
} from './callEvents.js';

export const INTERNAL_RPC_CORRELATION_ID_HEADER = 'x-agentg-correlation-id';

export type InternalTrpcContext = {
  callId?: string | undefined;
  callInput?: unknown;
  callOptions?: InternalRpcCallOptions | undefined;
  correlationId?: string | undefined;
  eventBus?: EventBus | undefined;
  progress?: ((progress: RpcProgressData) => void) | undefined;
  resolveCallOptions?: ((path: string) => InternalRpcCallOptions) | undefined;
};

export type InternalTrpcContextOptions = {
  eventBus?: EventBus | undefined;
};

const internalTrpcContextStorage = new AsyncLocalStorage<InternalTrpcContext>();

export function currentInternalRpcContext(): InternalTrpcContext | undefined {
  return internalTrpcContextStorage.getStore();
}

export function currentInternalRpcEventBus(): EventBus | undefined {
  return currentInternalRpcContext()?.eventBus;
}

export function createInternalTrpcContext(
  options: CreateHTTPContextOptions,
  contextOptions: InternalTrpcContextOptions = {}
): InternalTrpcContext {
  const correlationId = optionalHeader(options.req.headers[INTERNAL_RPC_CORRELATION_ID_HEADER]);
  const resolveCallOptions = createInternalRpcCallOptionsResolver(
    options.req.headers[INTERNAL_RPC_CALL_OPTIONS_HEADER]
  );

  return {
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(contextOptions.eventBus === undefined ? {} : { eventBus: contextOptions.eventBus }),
    resolveCallOptions
  };
}

export function createInternalTrpcService(targetPrefix: string) {
  const internalRpc = initTRPC.context<InternalTrpcContext>().create({
    errorFormatter({ error, shape }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError: error.cause instanceof ZodError ? treeifyError(error.cause) : null
        }
      };
    }
  });

  const lifecycleMiddleware = internalRpc.middleware(
    async ({ ctx, getRawInput, input, next, path }) => {
      const currentCtx = (ctx as InternalTrpcContext | undefined) ?? {};
      const callOptions = currentCtx.callOptions ?? currentCtx.resolveCallOptions?.(path) ?? {};
      const publishLifecycle = shouldPublishInternalRpcLifecycle(callOptions);
      const eventBus = eventBusForInternalRpcCall(currentCtx.eventBus, callOptions);
      const callId = `call_${randomUUID()}`;
      const eventInput = input === undefined ? await readRawInput(getRawInput) : input;
      const startedAt = new Date();
      const target = `${targetPrefix}.${path}`;

      if (publishLifecycle) {
        publishRpcCallEvent(
          eventBus,
          createRpcCallStartedEvent({
            callId,
            input: eventInput,
            startedAt,
            target
          })
        );
      }

      const progress = (progressData: RpcProgressData): void => {
        if (!publishLifecycle) {
          return;
        }

        publishRpcCallEvent(
          eventBus,
          createRpcCallProgressEvent({
            callId,
            input: eventInput,
            progress: progressData,
            startedAt,
            target
          })
        );
      };

      const nextContext: Partial<InternalTrpcContext> = {
        callId,
        callInput: eventInput,
        callOptions,
        progress
      };
      if (eventBus !== undefined) {
        nextContext.eventBus = eventBus;
      }

      const result = await internalTrpcContextStorage.run(nextContext, () =>
        next({
          ctx: nextContext
        })
      );

      if (!result.ok) {
        if (publishLifecycle) {
          publishRpcCallEvent(
            eventBus,
            createRpcCallFailedEvent({
              callId,
              error: errorFromUnknown(result.error),
              input: eventInput,
              startedAt,
              target
            })
          );
        }
        return result;
      }

      if (publishLifecycle) {
        publishRpcCallEvent(
          eventBus,
          createRpcCallCompletedEvent({
            callId,
            input: eventInput,
            startedAt,
            target
          })
        );
      }

      return result;
    }
  );

  return {
    createContext: createInternalTrpcContext,
    procedure: internalRpc.procedure.use(lifecycleMiddleware),
    router: internalRpc.router
  };
}

export type InternalTrpcService = ReturnType<typeof createInternalTrpcService>;
export type InternalTrpcProcedureBuilder = InternalTrpcService['procedure'];

function optionalHeader(value: string | string[] | undefined): string | undefined {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return typeof firstValue === 'string' && firstValue.trim().length > 0
    ? firstValue.trim()
    : undefined;
}

async function readRawInput(getRawInput: () => Promise<unknown>): Promise<unknown> {
  try {
    return await getRawInput();
  } catch {
    return undefined;
  }
}
