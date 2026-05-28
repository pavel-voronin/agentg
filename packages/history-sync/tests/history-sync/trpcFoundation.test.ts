import type { Server } from 'node:http';

import type { EventBus, EventSubscription } from '@agentg/events/bus';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/events/envelope';
import {
  RPC_CALL_COMPLETED_EVENT_SUFFIX,
  RPC_CALL_FAILED_EVENT_SUFFIX,
  RPC_CALL_PROGRESS_EVENT_SUFFIX,
  RPC_CALL_STARTED_EVENT_SUFFIX,
  rpcCallEventType
} from '@agentg/rpc/call-events';
import { createInternalTrpcClient } from '@agentg/rpc/client';
import { createInternalTrpcHttpServer } from '@agentg/rpc/http-server';
import { createInternalTrpcService } from '@agentg/rpc/trpc';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('History Sync tRPC foundation', () => {
  it('performs a package-local tRPC client/server round trip', async () => {
    const testRpc = createInternalTrpcService('history-sync-test');
    const testRouter = testRpc.router({
      domainError: testRpc.procedure.output(z.object({ value: z.string() })).query(() => {
        throw new Error('History Sync value was not found');
      }),
      echo: testRpc.procedure
        .input(z.object({ value: z.string() }))
        .output(z.object({ value: z.string() }))
        .query(({ input }) => ({
          value: input.value
        }))
    });
    const server = createInternalTrpcHttpServer({
      createContext: testRpc.createContext,
      router: testRouter
    });
    const port = await listenEphemeral(server);
    const client = createInternalTrpcClient<typeof testRouter>({
      url: `http://127.0.0.1:${String(port)}`
    });

    try {
      await expect(client.echo.query({ value: 'history' })).resolves.toEqual({
        value: 'history'
      });
      await expect(client.domainError.query()).rejects.toThrow('History Sync value was not found');
    } finally {
      await closeServer(server);
    }
  });

  it('publishes lifecycle, progress, and failed events by default', async () => {
    const publishedEvents: IntegrationEvent[] = [];
    const testRpc = createInternalTrpcService('history-sync');
    const caller = testRpc
      .router({
        domainError: testRpc.procedure
          .input(z.object({ value: z.string() }))
          .output(z.object({ value: z.string() }))
          .query(() => {
            throw new Error('History Sync value was denied');
          }),
        echo: testRpc.procedure
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
        throwing: testRpc.procedure.output(z.object({ value: z.string() })).query(() => {
          throw new Error('lifecycle boom');
        })
      })
      .createCaller({
        eventBus: createRecordingEventBus(publishedEvents)
      });

    await expect(caller.echo({ value: 'ok' })).resolves.toMatchObject({
      value: 'ok'
    });

    expect(publishedEvents.map((event) => event.type)).toEqual([
      rpcCallEventType('history-sync.echo', RPC_CALL_STARTED_EVENT_SUFFIX),
      rpcCallEventType('history-sync.echo', RPC_CALL_PROGRESS_EVENT_SUFFIX),
      rpcCallEventType('history-sync.echo', RPC_CALL_COMPLETED_EVENT_SUFFIX)
    ]);
    const successCallId = publishedEvents[0]?.data.callId;
    expect(typeof successCallId).toBe('string');
    expect(publishedEvents).toMatchObject([
      {
        data: {
          callId: successCallId,
          input: { value: 'ok' },
          target: 'history-sync.echo'
        }
      },
      {
        data: {
          callId: successCallId,
          progress: { step: 'loaded' },
          target: 'history-sync.echo'
        }
      },
      {
        data: {
          callId: successCallId,
          target: 'history-sync.echo'
        }
      }
    ]);
    expect(publishedEvents[2]?.data).not.toHaveProperty('output');

    publishedEvents.length = 0;

    await expect(caller.domainError({ value: 'denied' })).rejects.toThrow(
      'History Sync value was denied'
    );

    expect(publishedEvents.map((event) => event.type)).toEqual([
      rpcCallEventType('history-sync.domainError', RPC_CALL_STARTED_EVENT_SUFFIX),
      rpcCallEventType('history-sync.domainError', RPC_CALL_FAILED_EVENT_SUFFIX)
    ]);
    const domainErrorCallId = publishedEvents[0]?.data.callId;
    expect(publishedEvents[1]).toMatchObject({
      data: {
        callId: domainErrorCallId,
        error: {
          message: 'History Sync value was denied'
        },
        target: 'history-sync.domainError'
      }
    });

    publishedEvents.length = 0;

    await expect(caller.throwing()).rejects.toThrow('lifecycle boom');

    expect(publishedEvents.map((event) => event.type)).toEqual([
      rpcCallEventType('history-sync.throwing', RPC_CALL_STARTED_EVENT_SUFFIX),
      rpcCallEventType('history-sync.throwing', RPC_CALL_FAILED_EVENT_SUFFIX)
    ]);
    const thrownCallId = publishedEvents[0]?.data.callId;
    expect(publishedEvents[1]).toMatchObject({
      data: {
        callId: thrownCallId,
        error: {
          message: 'lifecycle boom'
        },
        target: 'history-sync.throwing'
      }
    });
  });

  it('applies per-call observable and silent options from batched HTTP headers', async () => {
    const publishedEvents: IntegrationEvent[] = [];
    const testRpc = createInternalTrpcService('history-sync');
    const testRouter = testRpc.router({
      defaultFact: testRpc.procedure
        .input(z.object({ value: z.string() }))
        .output(z.object({ value: z.string() }))
        .query(({ ctx, input }) => {
          ctx.eventBus?.publish(createFactEvent('history-sync.fact.default', input.value));
          return {
            value: input.value
          };
        }),
      quietFact: testRpc.procedure
        .input(z.object({ value: z.string() }))
        .output(z.object({ value: z.string() }))
        .query(({ ctx, input }) => {
          ctx.eventBus?.publish(createFactEvent('history-sync.fact.quiet', input.value));
          ctx.progress?.({
            step: 'quiet-progress'
          });
          return {
            value: input.value
          };
        }),
      silentFact: testRpc.procedure
        .input(z.object({ value: z.string() }))
        .output(z.object({ value: z.string() }))
        .query(({ ctx, input }) => {
          ctx.eventBus?.publish(createFactEvent('history-sync.fact.silent', input.value));
          ctx.progress?.({
            step: 'silent-progress'
          });
          return {
            value: input.value
          };
        })
    });
    const server = createInternalTrpcHttpServer({
      createContext: (options) =>
        testRpc.createContext(options, {
          eventBus: createRecordingEventBus(publishedEvents)
        }),
      router: testRouter
    });
    const port = await listenEphemeral(server);
    const client = createInternalTrpcClient<typeof testRouter>({
      url: `http://127.0.0.1:${String(port)}`
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
      rpcCallEventType('history-sync.defaultFact', RPC_CALL_STARTED_EVENT_SUFFIX)
    );
    expect(eventTypes).toContain(
      rpcCallEventType('history-sync.defaultFact', RPC_CALL_COMPLETED_EVENT_SUFFIX)
    );
    expect(eventTypes).toContain('history-sync.fact.default');
    expect(eventTypes).toContain('history-sync.fact.quiet');
    expect(eventTypes).not.toContain(
      rpcCallEventType('history-sync.quietFact', RPC_CALL_STARTED_EVENT_SUFFIX)
    );
    expect(eventTypes).not.toContain(
      rpcCallEventType('history-sync.quietFact', RPC_CALL_PROGRESS_EVENT_SUFFIX)
    );
    expect(eventTypes).not.toContain(
      rpcCallEventType('history-sync.quietFact', RPC_CALL_COMPLETED_EVENT_SUFFIX)
    );
    expect(eventTypes).not.toContain('history-sync.fact.silent');
    expect(eventTypes).not.toContain(
      rpcCallEventType('history-sync.silentFact', RPC_CALL_STARTED_EVENT_SUFFIX)
    );
    expect(eventTypes).not.toContain(
      rpcCallEventType('history-sync.silentFact', RPC_CALL_PROGRESS_EVENT_SUFFIX)
    );
    expect(eventTypes).not.toContain(
      rpcCallEventType('history-sync.silentFact', RPC_CALL_COMPLETED_EVENT_SUFFIX)
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
