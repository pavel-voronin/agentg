import { randomUUID } from 'node:crypto';

import type { EventBus } from '@agentg/shared/events/bus';
import {
  createInternalRpcCallOptionsResolver,
  eventBusForInternalRpcCall,
  INTERNAL_RPC_CALL_OPTIONS_HEADER,
  shouldPublishInternalRpcLifecycle,
  type InternalRpcCallOptions
} from '@agentg/shared/rpc/call-options';
import {
  createRpcCallCompletedEvent,
  createRpcCallFailedEvent,
  createRpcCallProgressEvent,
  createRpcCallStartedEvent,
  errorFromUnknown,
  publishRpcCallEvent,
  type RpcProgressData
} from '@agentg/shared/rpc/call-events';
import { isProcedureErrorEnvelope } from '@agentg/shared/rpc/envelope';
import { initTRPC } from '@trpc/server';
import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone';
import { treeifyError, ZodError } from 'zod';

export const INTERNAL_RPC_CORRELATION_ID_HEADER = 'x-agentg-correlation-id';

export type SummariesRpcContext = {
  callId?: string | undefined;
  callInput?: unknown;
  callOptions?: InternalRpcCallOptions | undefined;
  correlationId?: string | undefined;
  eventBus?: EventBus | undefined;
  progress?: ((progress: RpcProgressData) => void) | undefined;
  resolveCallOptions?: ((path: string) => InternalRpcCallOptions) | undefined;
};

export type SummariesRpcContextRuntime = {
  eventBus?: EventBus | undefined;
};

const SUMMARIES_RPC_SOURCE = 'summaries';
const SUMMARIES_RPC_TARGET_PREFIX = 'summaries';

export function createSummariesRpcContext(
  options: CreateHTTPContextOptions,
  runtime: SummariesRpcContextRuntime = {}
): SummariesRpcContext {
  const correlationId = optionalHeader(options.req.headers[INTERNAL_RPC_CORRELATION_ID_HEADER]);
  const resolveCallOptions = createInternalRpcCallOptionsResolver(
    options.req.headers[INTERNAL_RPC_CALL_OPTIONS_HEADER]
  );

  return {
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(runtime.eventBus === undefined ? {} : { eventBus: runtime.eventBus }),
    resolveCallOptions
  };
}

const summariesRpc = initTRPC.context<SummariesRpcContext>().create({
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

const lifecycleMiddleware = summariesRpc.middleware(
  async ({ ctx, getRawInput, input, next, path }) => {
    const currentCtx = (ctx as SummariesRpcContext | undefined) ?? {};
    const callOptions = currentCtx.callOptions ?? currentCtx.resolveCallOptions?.(path) ?? {};
    const publishLifecycle = shouldPublishInternalRpcLifecycle(callOptions);
    const eventBus = eventBusForInternalRpcCall(currentCtx.eventBus, callOptions);
    const callId = `call_${randomUUID()}`;
    const eventInput = input === undefined ? await readRawInput(getRawInput) : input;
    const startedAt = new Date();
    const target = `${SUMMARIES_RPC_TARGET_PREFIX}.${path}`;

    if (publishLifecycle) {
      publishRpcCallEvent(
        eventBus,
        createRpcCallStartedEvent({
          callId,
          input: eventInput,
          source: SUMMARIES_RPC_SOURCE,
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
          source: SUMMARIES_RPC_SOURCE,
          startedAt,
          target
        })
      );
    };

    const nextContext: Partial<SummariesRpcContext> = {
      callId,
      callInput: eventInput,
      callOptions,
      progress
    };
    if (eventBus !== undefined) {
      nextContext.eventBus = eventBus;
    }

    const result = await next({ ctx: nextContext });

    if (!result.ok) {
      if (publishLifecycle) {
        publishRpcCallEvent(
          eventBus,
          createRpcCallFailedEvent({
            callId,
            error: errorFromUnknown(result.error),
            input: eventInput,
            source: SUMMARIES_RPC_SOURCE,
            startedAt,
            target
          })
        );
      }
      return result;
    }

    if (isProcedureErrorEnvelope(result.data)) {
      if (publishLifecycle) {
        publishRpcCallEvent(
          eventBus,
          createRpcCallFailedEvent({
            callId,
            error: result.data.error,
            input: eventInput,
            output: result.data,
            source: SUMMARIES_RPC_SOURCE,
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
          output: result.data,
          source: SUMMARIES_RPC_SOURCE,
          startedAt,
          target
        })
      );
    }

    return result;
  }
);

export const summariesRpcRouter = summariesRpc.router;
export const rpc = summariesRpc.procedure.use(lifecycleMiddleware);

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
