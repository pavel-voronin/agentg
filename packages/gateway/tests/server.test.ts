import { randomUUID } from 'node:crypto';

import { ProcedureTransportError } from '@agentg/framework';
import type { EventBus, EventEnvelope, EventSubscription } from '@agentg/framework';
import type { PolicyClient } from '@agentg/framework/policies';
import type { dataClient } from '@agentg/data';
import type { pipelinesClient } from '@agentg/pipelines';
import type { telegramClient } from '@agentg/telegram';
import { WebSocket, type RawData } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';

import { startGatewayServer, type GatewayServerHandle } from '../src/server.js';

const gatewayHandles: GatewayServerHandle[] = [];
type TestTelegramAccess = Pick<
  ReturnType<typeof telegramClient>,
  'getChat' | 'getMessages' | 'listRecentMessages' | 'requestFile' | 'searchMessages'
>;
type TestDataAccess = Pick<
  ReturnType<typeof dataClient>,
  | 'expand'
  | 'get'
  | 'getAnnotation'
  | 'getCollectionItem'
  | 'listAnnotations'
  | 'listCollection'
  | 'listModels'
  | 'render'
  | 'select'
  | 'writeAnnotation'
  | 'writeCollectionItem'
>;
type TestPipelineAccess = Pick<
  ReturnType<typeof pipelinesClient>,
  | 'deletePipeline'
  | 'getPipeline'
  | 'getRun'
  | 'listPipelines'
  | 'listRuns'
  | 'runPipeline'
  | 'setPipeline'
>;
type TestPolicyAccess = Pick<
  PolicyClient,
  | 'deleteInstance'
  | 'getInstance'
  | 'getPolicyValue'
  | 'listInstances'
  | 'listPolicyKinds'
  | 'setInstance'
>;

describe('gateway server', () => {
  afterEach(async () => {
    await Promise.all(gatewayHandles.splice(0).map((handle) => handle.stop()));
  });

  it('routes explicit Telegram methods through WebSocket RPC', async () => {
    const calls: unknown[] = [];
    const gateway = await startGateway({
      telegram: {
        getChat(input) {
          if (
            typeof input !== 'object' ||
            input === null ||
            !('chatId' in input) ||
            typeof input.chatId !== 'string'
          ) {
            throw new Error('telegram.getChat requires chatId');
          }
          calls.push(input);
          return Promise.resolve({
            chat: {
              _model: 'telegram.chat',
              avatar: {
                big: null,
                small: null
              },
              id: input.chatId,
              title: 'Alice',
              type: 'private',
              updatedAt: '2026-05-02T00:00:00.000Z'
            }
          });
        },
        searchMessages(input) {
          calls.push(input);
          return Promise.resolve({
            messages: []
          });
        }
      }
    });
    const client = await connectGateway(gateway);

    try {
      await expect(request(client, 'telegram.getChat', { chatId: 'chat-a' })).resolves.toEqual({
        chat: {
          _model: 'telegram.chat',
          avatar: {
            big: null,
            small: null
          },
          id: 'chat-a',
          title: 'Alice',
          type: 'private',
          updatedAt: '2026-05-02T00:00:00.000Z'
        }
      });
      await expect(
        request(client, 'telegram.searchMessages', {
          limit: 5,
          query: 'policy'
        })
      ).resolves.toEqual({
        messages: []
      });
      await expect(request(client, 'files.request', {})).rejects.toThrow(
        'Unknown method: files.request'
      );
      await expect(request(client, 'capabilities.list', {})).rejects.toThrow(
        'Unknown method: capabilities.list'
      );
      expect(calls).toEqual([{ chatId: 'chat-a' }, { limit: 5, query: 'policy' }]);
    } finally {
      client.close();
    }
  });

  it('routes Data and Pipeline methods through WebSocket RPC', async () => {
    const calls: unknown[] = [];
    const gateway = await startGateway({
      data: {
        listModels() {
          calls.push(['data.listModels']);
          return Promise.resolve([
            {
              capabilities: ['select', 'get', 'expand', 'render'],
              model: 'telegram.chat',
              provider: 'telegram'
            }
          ]);
        },
        select(input) {
          calls.push(['data.select', input]);
          return Promise.resolve({
            rows: [
              {
                lineage: [{ _model: 'telegram.chat', id: '10' }],
                refs: { chat: { _model: 'telegram.chat', id: '10' } },
                value: { id: '10' }
              }
            ]
          });
        }
      },
      pipelines: {
        runPipeline(input) {
          calls.push(['pipelines.runPipeline', input]);
          return Promise.resolve({
            runId: 'run-1',
            status: 'accepted'
          });
        },
        setPipeline(input) {
          calls.push(['pipelines.setPipeline', input]);
          return Promise.resolve({
            name: 'digest',
            operation: 'set',
            status: 'applied'
          });
        }
      }
    });
    const client = await connectGateway(gateway);

    try {
      await expect(request(client, 'data.listModels', {})).resolves.toEqual([
        {
          capabilities: ['select', 'get', 'expand', 'render'],
          model: 'telegram.chat',
          provider: 'telegram'
        }
      ]);
      await expect(
        request(client, 'data.select', {
          model: 'telegram.chat',
          where: { readState: 'unread' }
        })
      ).resolves.toEqual({
        rows: [
          {
            lineage: [{ _model: 'telegram.chat', id: '10' }],
            refs: { chat: { _model: 'telegram.chat', id: '10' } },
            value: { id: '10' }
          }
        ]
      });
      await expect(
        request(client, 'pipelines.runPipeline', {
          name: 'digest'
        })
      ).resolves.toEqual({
        runId: 'run-1',
        status: 'accepted'
      });

      expect(calls).toEqual([
        ['data.listModels'],
        ['data.select', { model: 'telegram.chat', where: { readState: 'unread' } }],
        ['pipelines.runPipeline', { name: 'digest' }]
      ]);
    } finally {
      client.close();
    }
  });

  it('routes explicit policy control methods through WebSocket RPC', async () => {
    const calls: unknown[] = [];
    const gateway = await startGateway({
      policies: {
        deleteInstance(input) {
          calls.push(['deleteInstance', input]);
          return Promise.resolve({
            identity: input,
            operation: 'delete',
            policyValueChanged: true,
            status: 'applied'
          });
        },
        getInstance(input) {
          calls.push(['getInstance', input]);
          return Promise.resolve({
            apiVersion: 'agentg.dev/v1',
            kind: input.kind,
            metadata: {
              name: input.name
            },
            spec: {}
          });
        },
        getPolicyValue(input) {
          calls.push(['getPolicyValue', input]);
          return Promise.resolve([{ enabled: true }]);
        },
        listInstances(input) {
          calls.push(['listInstances', input]);
          return Promise.resolve([]);
        },
        listPolicyKinds() {
          calls.push(['listPolicyKinds']);
          return Promise.resolve([
            {
              form: {
                spec: {}
              },
              id: 'telegram.historyGapRestoreRule',
              kind: 'TelegramHistoryGapRestoreRule',
              moduleId: 'telegram',
              version: 1
            }
          ]);
        },
        setInstance(input) {
          calls.push(['setInstance', input]);
          return Promise.resolve({
            identity: {
              kind: input.document.kind,
              name: input.document.metadata.name
            },
            operation: 'set',
            policyValueChanged: true,
            status: 'applied'
          });
        }
      }
    });
    const client = await connectGateway(gateway);

    try {
      await expect(request(client, 'policies.listPolicyKinds', {})).resolves.toEqual([
        {
          form: {
            spec: {}
          },
          id: 'telegram.historyGapRestoreRule',
          kind: 'TelegramHistoryGapRestoreRule',
          moduleId: 'telegram',
          version: 1
        }
      ]);
      await expect(
        request(client, 'policies.setInstance', {
          document: {
            apiVersion: 'agentg.dev/v1',
            kind: 'TelegramHistoryGapRestoreRule',
            metadata: {
              name: 'digest'
            },
            spec: {
              enabled: true
            }
          }
        })
      ).resolves.toEqual({
        identity: {
          kind: 'TelegramHistoryGapRestoreRule',
          name: 'digest'
        },
        operation: 'set',
        policyValueChanged: true,
        status: 'applied'
      });
      await expect(
        request(client, 'policies.getPolicyValue', {
          kind: 'TelegramHistoryGapRestoreRule'
        })
      ).resolves.toEqual([{ enabled: true }]);

      expect(calls).toEqual([
        ['listPolicyKinds'],
        [
          'setInstance',
          {
            document: {
              apiVersion: 'agentg.dev/v1',
              kind: 'TelegramHistoryGapRestoreRule',
              metadata: {
                name: 'digest'
              },
              spec: {
                enabled: true
              }
            }
          }
        ],
        ['getPolicyValue', { kind: 'TelegramHistoryGapRestoreRule' }]
      ]);
    } finally {
      client.close();
    }
  });

  it('forwards only telegram.login.completed as an external event', async () => {
    const events = createFakeEventBus();
    const gateway = await startGateway({ events });
    const client = await connectGateway(gateway);

    try {
      expect(events.subjects()).toEqual(['telegram.login.completed']);

      const ignored = createEvent('telegram.status');
      await events.emit('telegram.status', ignored);

      const event = createEvent('telegram.login.completed');
      const responsePromise = nextPayload(client);
      await events.emit('telegram.login.completed', event);

      await expect(responsePromise).resolves.toEqual({ event });
    } finally {
      client.close();
    }
  });

  it('returns dependency_unavailable for an allowed method when Telegram is absent', async () => {
    const gateway = await startGateway({
      telegram: {
        getChat() {
          return Promise.reject(
            new ProcedureTransportError('Procedure transport failed: fetch failed')
          );
        }
      }
    });
    const client = await connectGateway(gateway);

    try {
      const id = `req_${randomUUID()}`;
      const responsePromise = nextResponse(client);
      client.send(
        JSON.stringify({
          id,
          method: 'telegram.getChat',
          params: {
            chatId: 'chat-a'
          }
        })
      );

      await expect(responsePromise).resolves.toEqual({
        error: {
          code: 'dependency_unavailable',
          message: 'Procedure transport failed: fetch failed'
        },
        id
      });
    } finally {
      client.close();
    }
  });

  it('requires bearer authorization when a gateway token is configured', async () => {
    const gateway = await startGateway({
      token: 'secret'
    });

    await expect(connectGateway(gateway)).rejects.toThrow('Unexpected server response: 401');
    await expect(connectGateway(gateway, { queryToken: 'secret' })).rejects.toThrow(
      'Unexpected server response: 401'
    );

    const client = await connectGateway(gateway, { token: 'secret' });
    client.close();
  });

  it('closes connections that send oversized payloads', async () => {
    const gateway = await startGateway();
    const client = await connectGateway(gateway);

    try {
      const close = nextClose(client);
      client.send('x'.repeat(1_000_001));

      await expect(close).resolves.toBe(1009);
    } finally {
      client.close();
    }
  });

  it('returns method_failed when Telegram returns a domain procedure error', async () => {
    const gateway = await startGateway({
      telegram: {
        getChat() {
          return Promise.reject(new Error('Telegram chat read failed'));
        }
      }
    });
    const client = await connectGateway(gateway);

    try {
      const id = `req_${randomUUID()}`;
      const responsePromise = nextResponse(client);
      client.send(
        JSON.stringify({
          id,
          method: 'telegram.getChat',
          params: {
            chatId: 'chat-a'
          }
        })
      );

      await expect(responsePromise).resolves.toEqual({
        error: {
          code: 'method_failed',
          message: 'Telegram chat read failed'
        },
        id
      });
    } finally {
      client.close();
    }
  });
});

async function startGateway(
  options: {
    data?: Partial<TestDataAccess> | undefined;
    pipelines?: Partial<TestPipelineAccess> | undefined;
    policies?: Partial<TestPolicyAccess> | undefined;
    telegram?: Partial<TestTelegramAccess> | undefined;
    events?: TestEventBus | undefined;
    token?: string | undefined;
  } = {}
): Promise<GatewayServerHandle> {
  const handle = await startGatewayServer({
    access: {
      data: {
        ...defaultDataAccess(),
        ...options.data
      },
      pipelines: {
        ...defaultPipelineAccess(),
        ...options.pipelines
      },
      policies: {
        ...defaultPolicyAccess(),
        ...options.policies
      },
      telegram: {
        ...defaultTelegramAccess(),
        ...options.telegram
      }
    },
    config: {
      host: '127.0.0.1',
      port: 0,
      ...(options.token === undefined ? {} : { token: options.token })
    },
    events: options.events ?? createFakeEventBus()
  });
  gatewayHandles.push(handle);
  return handle;
}

function defaultDataAccess(): TestDataAccess {
  return {
    expand: unavailableMethod('data.expand'),
    get: unavailableMethod('data.get'),
    getAnnotation: unavailableMethod('data.getAnnotation'),
    getCollectionItem: unavailableMethod('data.getCollectionItem'),
    listAnnotations: unavailableMethod('data.listAnnotations'),
    listCollection: unavailableMethod('data.listCollection'),
    listModels: unavailableMethod('data.listModels'),
    render: unavailableMethod('data.render'),
    select: unavailableMethod('data.select'),
    writeAnnotation: unavailableMethod('data.writeAnnotation'),
    writeCollectionItem: unavailableMethod('data.writeCollectionItem')
  };
}

function defaultPipelineAccess(): TestPipelineAccess {
  return {
    deletePipeline: unavailableMethod('pipelines.deletePipeline'),
    getPipeline: unavailableMethod('pipelines.getPipeline'),
    getRun: unavailableMethod('pipelines.getRun'),
    listPipelines: unavailableMethod('pipelines.listPipelines'),
    listRuns: unavailableMethod('pipelines.listRuns'),
    runPipeline: unavailableMethod('pipelines.runPipeline'),
    setPipeline: unavailableMethod('pipelines.setPipeline')
  };
}

function defaultPolicyAccess(): TestPolicyAccess {
  return {
    deleteInstance: unavailableMethod('policies.deleteInstance'),
    getInstance: unavailableMethod('policies.getInstance'),
    getPolicyValue: unavailableMethod('policies.getPolicyValue'),
    listInstances: unavailableMethod('policies.listInstances'),
    listPolicyKinds: unavailableMethod('policies.listPolicyKinds'),
    setInstance: unavailableMethod('policies.setInstance')
  };
}

function defaultTelegramAccess(): TestTelegramAccess {
  return {
    getChat: unavailableMethod('telegram.getChat'),
    getMessages: unavailableMethod('telegram.getMessages'),
    listRecentMessages: unavailableMethod('telegram.listRecentMessages'),
    requestFile: unavailableMethod('telegram.requestFile'),
    searchMessages: unavailableMethod('telegram.searchMessages')
  };
}

function unavailableMethod(method: string) {
  return () => Promise.reject(new ProcedureTransportError(`Procedure transport failed: ${method}`));
}

async function connectGateway(
  handle: GatewayServerHandle,
  options: { queryToken?: string | undefined; token?: string | undefined } = {}
): Promise<WebSocket> {
  const url = new URL(`ws://${handle.host}:${String(handle.port)}`);
  if (options.queryToken !== undefined) {
    url.searchParams.set('token', options.queryToken);
  }
  const client = new WebSocket(
    url,
    options.token === undefined
      ? undefined
      : {
          headers: {
            authorization: `Bearer ${options.token}`
          }
        }
  );
  await new Promise<void>((resolve, reject) => {
    client.once('open', resolve);
    client.once('error', reject);
  });

  return client;
}

async function nextClose(client: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    client.once('close', (code) => {
      resolve(code);
    });
  });
}

async function request(client: WebSocket, method: string, params: unknown): Promise<unknown> {
  const id = `req_${randomUUID()}`;
  const responsePromise = nextResponse(client);
  client.send(
    JSON.stringify({
      id,
      method,
      params
    })
  );
  const response = await responsePromise;
  if (response.id !== id) {
    throw new Error(`Unexpected response id: ${String(response.id)}`);
  }
  if (response.error !== undefined) {
    throw new Error(response.error.message);
  }

  return response.result;
}

async function nextResponse(client: WebSocket): Promise<GatewayResponse> {
  const payload = await nextPayload(client);
  const record = asRecord(payload);
  if (record === undefined) {
    throw new Error('Gateway response must be an object');
  }

  const id = record.id;
  if (typeof id !== 'string' && typeof id !== 'number' && id !== null) {
    throw new Error('Gateway response id must be string, number, or null');
  }

  const errorRecord = asRecord(record.error);
  const error =
    errorRecord === undefined
      ? undefined
      : {
          code: typeof errorRecord.code === 'string' ? errorRecord.code : 'unknown',
          message: typeof errorRecord.message === 'string' ? errorRecord.message : ''
        };

  return {
    ...(error === undefined ? {} : { error }),
    id,
    ...(Object.hasOwn(record, 'result') ? { result: record.result } : {})
  };
}

async function nextPayload(client: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    client.once('message', (payload) => {
      try {
        resolve(JSON.parse(rawDataToString(payload)) as unknown);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

type GatewayResponse = {
  error?: { code: string; message: string } | undefined;
  id: number | string | null;
  result?: unknown;
};

type TestEventBus = EventBus & {
  emit(subject: string, event: EventEnvelope): Promise<void>;
  subjects(): string[];
};

function createFakeEventBus(): TestEventBus {
  const handlers = new Map<string, (event: EventEnvelope) => void | Promise<void>>();

  return {
    async emit(subject, event): Promise<void> {
      await handlers.get(subject)?.(event);
    },
    publish(): void {
      return;
    },
    start(): Promise<void> {
      return Promise.resolve();
    },
    stop(): Promise<void> {
      return Promise.resolve();
    },
    subscribe(subject, handler): EventSubscription {
      handlers.set(subject, handler);
      return {
        unsubscribe(): void {
          handlers.delete(subject);
        }
      };
    },
    subjects(): string[] {
      return [...handlers.keys()];
    }
  };
}

function createEvent(type: string): EventEnvelope {
  return {
    at: '2026-05-05T00:00:00.000Z',
    data: {},
    id: `evt_${randomUUID()}`,
    trace: {},
    type
  };
}

function rawDataToString(payload: RawData): string {
  if (typeof payload === 'string') {
    return payload;
  }
  if (Buffer.isBuffer(payload)) {
    return payload.toString('utf8');
  }
  if (Array.isArray(payload)) {
    return Buffer.concat(payload).toString('utf8');
  }
  return Buffer.from(payload).toString('utf8');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
