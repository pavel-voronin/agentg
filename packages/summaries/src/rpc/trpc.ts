import { randomUUID } from 'node:crypto';

import type { EventBus } from '@agentg/shared/events/bus';
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
  callId?: string;
  callInput?: unknown;
  correlationId?: string;
  eventBus?: EventBus;
  progress?: (progress: RpcProgressData) => void;
};

export type SummariesRpcContextRuntime = {
  eventBus?: EventBus;
};

const SUMMARIES_RPC_SOURCE = 'summaries';
const SUMMARIES_RPC_TARGET_PREFIX = 'summaries';

export function createSummariesRpcContext(
  options: CreateHTTPContextOptions,
  runtime: SummariesRpcContextRuntime = {}
): SummariesRpcContext {
  const correlationId = optionalHeader(options.req.headers[INTERNAL_RPC_CORRELATION_ID_HEADER]);

  return {
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(runtime.eventBus === undefined ? {} : { eventBus: runtime.eventBus })
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

const observableMiddleware = summariesRpc.middleware(
  async ({ ctx, getRawInput, input, next, path }) => {
    const callId = `call_${randomUUID()}`;
    const eventInput = input === undefined ? await readRawInput(getRawInput) : input;
    const startedAt = new Date();
    const target = `${SUMMARIES_RPC_TARGET_PREFIX}.${path}`;

    publishRpcCallEvent(
      ctx.eventBus,
      createRpcCallStartedEvent({
        callId,
        input: eventInput,
        source: SUMMARIES_RPC_SOURCE,
        startedAt,
        target
      })
    );

    const progress = (progressData: RpcProgressData): void => {
      publishRpcCallEvent(
        ctx.eventBus,
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

    const result = await next({
      ctx: {
        callId,
        callInput: eventInput,
        progress
      }
    });

    if (!result.ok) {
      publishRpcCallEvent(
        ctx.eventBus,
        createRpcCallFailedEvent({
          callId,
          error: errorFromUnknown(result.error),
          input: eventInput,
          source: SUMMARIES_RPC_SOURCE,
          startedAt,
          target
        })
      );
      return result;
    }

    if (isProcedureErrorEnvelope(result.data)) {
      publishRpcCallEvent(
        ctx.eventBus,
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
      return result;
    }

    publishRpcCallEvent(
      ctx.eventBus,
      createRpcCallCompletedEvent({
        callId,
        input: eventInput,
        output: result.data,
        source: SUMMARIES_RPC_SOURCE,
        startedAt,
        target
      })
    );

    return result;
  }
);

export const summariesRpcRouter = summariesRpc.router;
export const rpc = summariesRpc.procedure;
export const observable = rpc.use(observableMiddleware);
export const extension = rpc;

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
