import type { Server } from 'node:http';

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import type { IntegrationEvent } from '@agentg/shared/events/envelope';
import {
  RPC_CALL_COMPLETED_EVENT_SUFFIX,
  RPC_CALL_FAILED_EVENT_SUFFIX,
  RPC_CALL_PROGRESS_EVENT_SUFFIX,
  RPC_CALL_STARTED_EVENT_SUFFIX,
  rpcCallEventType
} from '@agentg/shared/rpc/call-events';
import {
  domainErrorEnvelope,
  okEnvelope,
  procedureEnvelopeSchema
} from '@agentg/shared/rpc/envelope';
import {
  createExtensionRegistry,
  extensionCallInputSchema,
  type ExtensionCallInput
} from '@agentg/shared/rpc/extensions';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  createHistoryRpcContext,
  enriched,
  extension,
  historyRpcRouter,
  INTERNAL_RPC_CORRELATION_ID_HEADER,
  observable,
  rpc
} from '../../src/rpc/trpc.js';

describe('History tRPC foundation', () => {
  it('performs a package-local tRPC client/server round trip', async () => {
    const testRouter = historyRpcRouter({
      domainError: rpc.output(procedureEnvelopeSchema(z.object({ value: z.string() }))).query(() =>
        domainErrorEnvelope({
          code: 'history.not_found',
          message: 'History value was not found'
        })
      ),
      echo: rpc
        .input(z.object({ value: z.string() }))
        .output(
          procedureEnvelopeSchema(
            z.object({ correlationId: z.string().optional(), value: z.string() })
          )
        )
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
          headers: {
            [INTERNAL_RPC_CORRELATION_ID_HEADER]: 'history-stage-1'
          },
          url: `http://127.0.0.1:${String(port)}`
        })
      ]
    });

    try {
      await expect(client.echo.query({ value: 'history' })).resolves.toEqual({
        extensions: {},
        ok: true,
        result: {
          correlationId: 'history-stage-1',
          value: 'history'
        }
      });
      await expect(client.domainError.query()).resolves.toEqual({
        error: {
          code: 'history.not_found',
          message: 'History value was not found'
        },
        extensions: {},
        ok: false
      });
    } finally {
      await closeServer(server);
    }
  });

  it('publishes observable lifecycle, progress, and failed events', async () => {
    const publishedEvents: IntegrationEvent[] = [];
    const caller = historyRpcRouter({
      domainError: observable
        .input(z.object({ value: z.string() }))
        .output(procedureEnvelopeSchema(z.object({ value: z.string() })))
        .query(() =>
          domainErrorEnvelope({
            code: 'history.denied',
            message: 'History value was denied'
          })
        ),
      echo: observable
        .input(z.object({ value: z.string() }))
        .output(procedureEnvelopeSchema(z.object({ callId: z.string(), value: z.string() })))
        .query(({ ctx, input }) => {
          ctx.progress({
            step: 'loaded'
          });

          return {
            callId: ctx.callId,
            value: input.value
          };
        }),
      throwing: observable
        .output(procedureEnvelopeSchema(z.object({ value: z.string() })))
        .query(() => {
          throw new Error('observable boom');
        })
    }).createCaller({
      eventBus: createRecordingEventBus(publishedEvents)
    });

    await expect(caller.echo({ value: 'ok' })).resolves.toMatchObject({
      ok: true,
      result: {
        value: 'ok'
      }
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
        source: 'history-sync',
        data: {
          callId: successCallId,
          input: { value: 'ok' },
          target: 'history.echo'
        }
      },
      {
        source: 'history-sync',
        data: {
          callId: successCallId,
          progress: { step: 'loaded' },
          target: 'history.echo'
        }
      },
      {
        source: 'history-sync',
        data: {
          callId: successCallId,
          output: {
            ok: true,
            result: {
              value: 'ok'
            }
          },
          target: 'history.echo'
        }
      }
    ]);

    publishedEvents.length = 0;

    await expect(caller.domainError({ value: 'denied' })).resolves.toMatchObject({
      error: {
        code: 'history.denied',
        message: 'History value was denied'
      },
      ok: false
    });

    expect(publishedEvents.map((event) => event.type)).toEqual([
      rpcCallEventType('history.domainError', RPC_CALL_STARTED_EVENT_SUFFIX),
      rpcCallEventType('history.domainError', RPC_CALL_FAILED_EVENT_SUFFIX)
    ]);
    const domainErrorCallId = publishedEvents[0]?.data.callId;
    expect(publishedEvents[1]).toMatchObject({
      data: {
        callId: domainErrorCallId,
        error: {
          code: 'history.denied',
          message: 'History value was denied'
        },
        output: {
          ok: false
        },
        target: 'history.domainError'
      }
    });

    publishedEvents.length = 0;

    await expect(caller.throwing()).rejects.toThrow('observable boom');

    expect(publishedEvents.map((event) => event.type)).toEqual([
      rpcCallEventType('history.throwing', RPC_CALL_STARTED_EVENT_SUFFIX),
      rpcCallEventType('history.throwing', RPC_CALL_FAILED_EVENT_SUFFIX)
    ]);
    const thrownCallId = publishedEvents[0]?.data.callId;
    expect(publishedEvents[1]).toMatchObject({
      data: {
        callId: thrownCallId,
        error: {
          message: 'observable boom'
        },
        target: 'history.throwing'
      }
    });
  });

  it('refreshes registrations and removes stale extension entries', () => {
    const registry = createExtensionRegistry({ ttlMs: 1000 });
    const registeredAt = new Date('2026-05-02T00:00:00.000Z');
    const refreshedAt = new Date('2026-05-02T00:00:00.500Z');

    expect(
      registry.register(
        {
          extension: 'summaries.chatSummary',
          target: 'history.enrichedEcho'
        },
        registeredAt
      )
    ).toMatchObject({
      extension: 'summaries.chatSummary',
      refreshed: false,
      registered: true,
      target: 'history.enrichedEcho'
    });

    expect(
      registry.register(
        {
          extension: 'summaries.chatSummary',
          target: 'history.enrichedEcho'
        },
        refreshedAt
      )
    ).toMatchObject({
      extension: 'summaries.chatSummary',
      refreshed: true,
      registered: false,
      target: 'history.enrichedEcho'
    });

    expect(registry.list('history.enrichedEcho', refreshedAt)).toHaveLength(1);
    expect(registry.list('history.enrichedEcho', new Date('2026-05-02T00:00:01.501Z'))).toEqual([]);
  });

  it('attaches registered extension results to enriched envelopes', async () => {
    const publishedEvents: IntegrationEvent[] = [];
    const registry = createExtensionRegistry({ ttlMs: 60000 });
    const extensionCalls: ExtensionCallInput[] = [];
    registry.register({
      extension: 'bad.failure',
      target: 'history.enrichedEcho'
    });
    registry.register({
      extension: 'slow.timeout',
      target: 'history.enrichedEcho'
    });
    registry.register({
      extension: 'summaries.chatSummary',
      target: 'history.enrichedEcho'
    });

    const caller = historyRpcRouter({
      enrichedEcho: enriched
        .input(z.object({ value: z.string() }))
        .output(procedureEnvelopeSchema(z.object({ value: z.string() })))
        .query(({ input }) => ({
          value: input.value
        }))
    }).createCaller({
      eventBus: createRecordingEventBus(publishedEvents),
      extensionCallTimeoutMs: 1,
      extensionRegistry: registry,
      resolveExtensionCaller(slug) {
        if (slug === 'summaries') {
          return (_extensionName, input) => {
            extensionCalls.push(input);
            return Promise.resolve(
              okEnvelope({
                summary: `summary:${(input.output as { value: string }).value}`
              })
            );
          };
        }

        if (slug === 'slow') {
          return () => new Promise(() => undefined);
        }

        if (slug === 'bad') {
          return () => {
            throw new Error('extension failed');
          };
        }

        return undefined;
      }
    });

    await expect(caller.enrichedEcho({ value: 'chat-a' })).resolves.toMatchObject({
      extensions: {
        'bad.failure': {
          error: {
            code: 'extension_failed',
            message: 'extension failed'
          },
          ok: false
        },
        'slow.timeout': {
          error: {
            code: 'extension_timeout'
          },
          ok: false
        },
        'summaries.chatSummary': {
          ok: true,
          result: {
            summary: 'summary:chat-a'
          }
        }
      },
      ok: true,
      result: {
        value: 'chat-a'
      }
    });

    expect(extensionCalls).toEqual([
      {
        callId: expect.any(String) as string,
        input: {
          value: 'chat-a'
        },
        output: {
          value: 'chat-a'
        },
        target: 'history.enrichedEcho'
      }
    ]);
    expect(publishedEvents.map((event) => event.type)).toEqual([
      rpcCallEventType('history.enrichedEcho', RPC_CALL_STARTED_EVENT_SUFFIX),
      rpcCallEventType('history.enrichedEcho', RPC_CALL_COMPLETED_EVENT_SUFFIX)
    ]);
    expect(publishedEvents[1]).toMatchObject({
      data: {
        output: {
          extensions: {
            'summaries.chatSummary': {
              ok: true
            }
          },
          ok: true
        },
        target: 'history.enrichedEcho'
      }
    });
  });

  it('builds module-owned extension methods', async () => {
    const caller = historyRpcRouter({
      chatSummary: extension
        .input(extensionCallInputSchema)
        .output(procedureEnvelopeSchema(z.object({ summary: z.string() })))
        .query(({ input }) => ({
          summary: `${input.target}:${(input.output as { value: string }).value}`
        }))
    }).createCaller({});

    await expect(
      caller.chatSummary({
        callId: 'call-a',
        output: {
          value: 'chat-a'
        },
        target: 'history.enrichedEcho'
      })
    ).resolves.toEqual({
      extensions: {},
      ok: true,
      result: {
        summary: 'history.enrichedEcho:chat-a'
      }
    });
  });
});

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
