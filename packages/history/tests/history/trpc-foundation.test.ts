import type { Server } from 'node:http';

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { EventBus, EventSubscription } from '@agentg/events/bus';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/events/envelope';
import {
  RPC_CALL_COMPLETED_EVENT_SUFFIX,
  RPC_CALL_FAILED_EVENT_SUFFIX,
  RPC_CALL_PROGRESS_EVENT_SUFFIX,
  RPC_CALL_STARTED_EVENT_SUFFIX,
  rpcCallEventType
} from '@agentg/rpc/call-events';
import { createInternalRpcCallOptionsHeaders } from '@agentg/rpc/call-options';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  createHistoryRpcContext,
  historyRpcRouter,
  INTERNAL_RPC_CORRELATION_ID_HEADER,
  rpc
} from '../../src/rpc/trpc.js';

describe('History tRPC foundation', () => {
  it('performs a package-local tRPC client/server round trip', async () => {
    const testRouter = historyRpcRouter({
      domainError: rpc.output(z.object({ value: z.string() })).query(() => {
        throw new Error('History value was not found');
      }),
      echo: rpc
        .input(z.object({ value: z.string() }))
        .output(z.object({ correlationId: z.string().optional(), value: z.string() }))
        .query(({ ctx, input }) => ({
          ...(ctx.correlationId === undefined ? {} : { correlationId: ctx.correlationId }),
          value: input.value
        }))
    });
    const server = createHTTPServer({
      createContext: createHistoryRpcContext,
      router: testRouter
    });
    const port = await listenEphemeral(server);
    const client = createTRPCClient<typeof testRouter>({
      links: [
        httpBatchLink({
          headers({ opList }) {
            return {
              [INTERNAL_RPC_CORRELATION_ID_HEADER]: 'history-stage-1',
              ...createInternalRpcCallOptionsHeaders(opList)
            };
          },
          url: `http://127.0.0.1:${String(port)}`
        })
      ]
    });

    try {
      await expect(client.echo.query({ value: 'history' })).resolves.toEqual({
        correlationId: 'history-stage-1',
        value: 'history'
      });
      await expect(client.domainError.query()).rejects.toThrow('History value was not found');
    } finally {
      await closeServer(server);
    }
  });

  it('publishes lifecycle, progress, and failed events by default', async () => {
    const publishedEvents: IntegrationEvent[] = [];
    const caller = historyRpcRouter({
      domainError: rpc
        .input(z.object({ value: z.string() }))
        .output(z.object({ value: z.string() }))
        .query(() => {
          throw new Error('History value was denied');
        }),
      echo: rpc
        .input(z.object({ value: z.string() }))
        .output(z.object({ callId: z.string(), value: z.string() }))
        .query(({ ctx, input }) => {
          ctx.progress?.({
            step: 'loaded'
          });

          return {
            callId: ctx.callId ?? '',
            value: input.value
          };
        }),
      throwing: rpc.output(z.object({ value: z.string() })).query(() => {
        throw new Error('lifecycle boom');
      })
    }).createCaller({
      eventBus: createRecordingEventBus(publishedEvents)
    });

    await expect(caller.echo({ value: 'ok' })).resolves.toMatchObject({
      value: 'ok'
    });

    expect(publishedEvents.map((event) => event.type)).toEqual([
      rpcCallEventType('history.echo', RPC_CALL_STARTED_EVENT_SUFFIX),
      rpcCallEventType('history.echo', RPC_CALL_PROGRESS_EVENT_SUFFIX),
      rpcCallEventType('history.echo', RPC_CALL_COMPLETED_EVENT_SUFFIX)
    ]);
    const successCallId = publishedEvents[0]?.data.callId;
    expect(typeof successCallId).toBe('string');
    expect(publishedEvents).toMatchObject([
      {
        data: {
          callId: successCallId,
          input: { value: 'ok' },
          target: 'history.echo'
        }
      },
      {
        data: {
          callId: successCallId,
          progress: { step: 'loaded' },
          target: 'history.echo'
        }
      },
      {
        data: {
          callId: successCallId,
          output: {
            value: 'ok'
          },
          target: 'history.echo'
        }
      }
    ]);

    publishedEvents.length = 0;

    await expect(caller.domainError({ value: 'denied' })).rejects.toThrow(
      'History value was denied'
    );

    expect(publishedEvents.map((event) => event.type)).toEqual([
      rpcCallEventType('history.domainError', RPC_CALL_STARTED_EVENT_SUFFIX),
      rpcCallEventType('history.domainError', RPC_CALL_FAILED_EVENT_SUFFIX)
    ]);
    const domainErrorCallId = publishedEvents[0]?.data.callId;
    expect(publishedEvents[1]).toMatchObject({
      data: {
        callId: domainErrorCallId,
        error: {
          message: 'History value was denied'
        },
        target: 'history.domainError'
      }
    });

    publishedEvents.length = 0;

    await expect(caller.throwing()).rejects.toThrow('lifecycle boom');

    expect(publishedEvents.map((event) => event.type)).toEqual([
      rpcCallEventType('history.throwing', RPC_CALL_STARTED_EVENT_SUFFIX),
      rpcCallEventType('history.throwing', RPC_CALL_FAILED_EVENT_SUFFIX)
    ]);
    const thrownCallId = publishedEvents[0]?.data.callId;
    expect(publishedEvents[1]).toMatchObject({
      data: {
        callId: thrownCallId,
        error: {
          message: 'lifecycle boom'
        },
        target: 'history.throwing'
      }
    });
  });

  it('applies per-call observable and silent options from batched HTTP headers', async () => {
    const publishedEvents: IntegrationEvent[] = [];
    const testRouter = historyRpcRouter({
      defaultFact: rpc
        .input(z.object({ value: z.string() }))
        .output(z.object({ value: z.string() }))
        .query(({ ctx, input }) => {
          ctx.eventBus?.publish(createFactEvent('history.fact.default', input.value));
          return {
            value: input.value
          };
        }),
      quietFact: rpc
        .input(z.object({ value: z.string() }))
        .output(z.object({ value: z.string() }))
        .query(({ ctx, input }) => {
          ctx.eventBus?.publish(createFactEvent('history.fact.quiet', input.value));
          ctx.progress?.({
            step: 'quiet-progress'
          });
          return {
            value: input.value
          };
        }),
      silentFact: rpc
        .input(z.object({ value: z.string() }))
        .output(z.object({ value: z.string() }))
        .query(({ ctx, input }) => {
          ctx.eventBus?.publish(createFactEvent('history.fact.silent', input.value));
          ctx.progress?.({
            step: 'silent-progress'
          });
          return {
            value: input.value
          };
        })
    });
    const server = createHTTPServer({
      createContext: (options) =>
        createHistoryRpcContext(options, {
          eventBus: createRecordingEventBus(publishedEvents)
        }),
      router: testRouter
    });
    const port = await listenEphemeral(server);
    const client = createTRPCClient<typeof testRouter>({
      links: [
        httpBatchLink({
          headers: ({ opList }) => createInternalRpcCallOptionsHeaders(opList),
          url: `http://127.0.0.1:${String(port)}`
        })
      ]
    });

    try {
      await expect(
        Promise.all([
          client.defaultFact.query({ value: 'default' }),
          client.quietFact.query(
            { value: 'quiet' },
            {
              context: {
                observable: false
              }
            }
          ),
          client.silentFact.query(
            { value: 'silent' },
            {
              context: {
                silent: true
              }
            }
          )
        ])
      ).resolves.toEqual([{ value: 'default' }, { value: 'quiet' }, { value: 'silent' }]);
    } finally {
      await closeServer(server);
    }

    const eventTypes = publishedEvents.map((event) => event.type);
    expect(eventTypes).toContain(
      rpcCallEventType('history.defaultFact', RPC_CALL_STARTED_EVENT_SUFFIX)
    );
    expect(eventTypes).toContain(
      rpcCallEventType('history.defaultFact', RPC_CALL_COMPLETED_EVENT_SUFFIX)
    );
    expect(eventTypes).toContain('history.fact.default');
    expect(eventTypes).toContain('history.fact.quiet');
    expect(eventTypes).not.toContain(
      rpcCallEventType('history.quietFact', RPC_CALL_STARTED_EVENT_SUFFIX)
    );
    expect(eventTypes).not.toContain(
      rpcCallEventType('history.quietFact', RPC_CALL_PROGRESS_EVENT_SUFFIX)
    );
    expect(eventTypes).not.toContain(
      rpcCallEventType('history.quietFact', RPC_CALL_COMPLETED_EVENT_SUFFIX)
    );
    expect(eventTypes).not.toContain('history.fact.silent');
    expect(eventTypes).not.toContain(
      rpcCallEventType('history.silentFact', RPC_CALL_STARTED_EVENT_SUFFIX)
    );
    expect(eventTypes).not.toContain(
      rpcCallEventType('history.silentFact', RPC_CALL_PROGRESS_EVENT_SUFFIX)
    );
    expect(eventTypes).not.toContain(
      rpcCallEventType('history.silentFact', RPC_CALL_COMPLETED_EVENT_SUFFIX)
    );
  });
});

function createFactEvent(type: string, value: string): IntegrationEvent {
  return createIntegrationEvent({
    data: {
      value
    },
    type
  });
}

function listenEphemeral(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        resolve(address.port);
        return;
      }

      throw new Error('tRPC test server did not expose a TCP port');
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function createRecordingEventBus(events: IntegrationEvent[]): EventBus {
  return {
    close(): Promise<void> {
      return Promise.resolve();
    },
    publish(event): void {
      events.push(event);
    },
    subscribe(): EventSubscription {
      return {
        unsubscribe(): void {
          return;
        }
      };
    }
  };
}
