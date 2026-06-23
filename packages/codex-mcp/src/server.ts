#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-deprecated -- MCP stdio server uses the low-level SDK server API. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebSocket, type RawData } from 'ws';

type JsonRpcId = string | number;

type GatewayRequest = {
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

type GatewayResponse = {
  error?: {
    code: string;
    message: string;
  };
  id: JsonRpcId | null;
  result?: unknown;
};

type GatewayEvent = {
  at: string;
  data?: unknown;
  id: string;
  type: string;
};

type GatewayEventPayload = {
  event?: GatewayEvent;
};

type Config = {
  eventBufferSize: number;
  reconnectDelayMs: number;
  requestTimeoutMs: number;
  token?: string;
  wsUrl: string;
};

type PendingRequest = {
  reject(reason: Error): void;
  resolve(value: unknown): void;
  timeout: NodeJS.Timeout;
};

export type ToolBridge = {
  call(method: string, params?: unknown): Promise<unknown>;
  readEvents(input: { clear: boolean; limit: number }): readonly unknown[];
  status(): Record<string, unknown>;
};

const DEFAULT_EVENT_BUFFER_SIZE = 100;
const DEFAULT_RECONNECT_DELAY_MS = 2_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const debugEnabled = process.env.AGENTG_CODEX_MCP_DEBUG === '1';

function readConfig(): Config {
  const token = optionalString(process.env.GATEWAY_TOKEN);

  return {
    eventBufferSize: integerEnv('GATEWAY_EVENT_BUFFER_SIZE', DEFAULT_EVENT_BUFFER_SIZE),
    reconnectDelayMs: integerEnv('GATEWAY_RECONNECT_DELAY_MS', DEFAULT_RECONNECT_DELAY_MS),
    requestTimeoutMs: integerEnv('GATEWAY_REQUEST_TIMEOUT_MS', DEFAULT_REQUEST_TIMEOUT_MS),
    ...(token === undefined ? {} : { token }),
    wsUrl: new URL(process.env.GATEWAY_WS_URL ?? 'ws://127.0.0.1:8787/').toString()
  };
}

class GatewayBridge {
  private connecting: Promise<void> | null = null;
  private nextRequestId = 1;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private ws: WebSocket | null = null;
  private readonly events: GatewayEvent[] = [];
  private readonly pending = new Map<JsonRpcId, PendingRequest>();

  constructor(private readonly config: Config) {}

  start(): void {
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.rejectPending('gateway websocket closed');
  }

  async call(method: string, params?: unknown): Promise<unknown> {
    const ws = await this.readySocket();
    const id = 'codex_' + String(this.nextRequestId++);
    const request: GatewayRequest =
      params === undefined
        ? {
            id,
            method
          }
        : {
            id,
            method,
            params
          };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new Error(`${method} timed out`));
        }
      }, this.config.requestTimeoutMs);
      timeout.unref();

      this.pending.set(id, { reject, resolve, timeout });
      debug(`gateway request ${id} ${method}`);
      ws.send(JSON.stringify(request), (error) => {
        if (error != null && this.pending.delete(id)) {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }

  status(): Record<string, unknown> {
    return {
      bufferedEvents: this.events.length,
      connected: this.ws?.readyState === WebSocket.OPEN,
      pendingRequests: this.pending.size,
      wsUrl: this.config.wsUrl
    };
  }

  readEvents(input: { clear: boolean; limit: number }): readonly GatewayEvent[] {
    const events = this.events.slice(-input.limit);
    if (input.clear) {
      this.events.length = 0;
    }
    return events;
  }

  private connect(): void {
    if (this.stopped) {
      return;
    }

    const url = new URL(this.config.wsUrl);
    const ws = new WebSocket(
      url,
      this.config.token === undefined
        ? undefined
        : {
            headers: {
              authorization: `Bearer ${this.config.token}`
            }
          }
    );
    this.ws = ws;
    this.connecting = new Promise((resolve, reject) => {
      ws.once('open', () => {
        process.stderr.write('agentg codex mcp: gateway websocket connected\n');
        resolve();
      });
      ws.once('close', () => {
        reject(new Error('gateway websocket closed before connection opened'));
      });
      ws.once('error', (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
    void this.connecting.catch(() => undefined);

    ws.on('message', (data) => {
      this.handleMessage(rawDataToString(data));
    });
    ws.on('close', () => {
      if (this.ws === ws) {
        this.ws = null;
        this.connecting = null;
      }
      this.rejectPending('gateway websocket closed');
      this.scheduleReconnect();
    });
    ws.on('error', (error) => {
      process.stderr.write(`agentg codex mcp: gateway websocket error: ${errorMessage(error)}\n`);
    });
  }

  private handleMessage(payloadText: string): void {
    let payload: GatewayResponse | GatewayEventPayload;
    try {
      payload = JSON.parse(payloadText) as GatewayResponse | GatewayEventPayload;
    } catch (error) {
      process.stderr.write(
        `agentg codex mcp: gateway payload is not JSON: ${errorMessage(error)}\n`
      );
      return;
    }

    if ('id' in payload && payload.id !== null) {
      debug(`gateway response ${String(payload.id)}`);
      const pending = this.pending.get(payload.id);
      if (pending === undefined) {
        debug(`gateway response ${String(payload.id)} has no pending request`);
        return;
      }
      this.pending.delete(payload.id);
      clearTimeout(pending.timeout);
      if (payload.error !== undefined) {
        pending.reject(new Error(payload.error.message));
        return;
      }
      pending.resolve(payload.result);
      return;
    }

    const event = 'event' in payload ? payload.event : undefined;
    if (event === undefined) {
      return;
    }

    this.events.push(event);
    if (this.events.length > this.config.eventBufferSize) {
      this.events.splice(0, this.events.length - this.config.eventBufferSize);
    }
  }

  private async readySocket(): Promise<WebSocket> {
    const ws = this.ws;
    if (ws?.readyState === WebSocket.OPEN) {
      return ws;
    }

    if (this.connecting !== null) {
      await this.connecting;
      const connected = this.ws;
      if (connected?.readyState === WebSocket.OPEN) {
        return connected;
      }
    }

    throw new Error('AgentG Gateway websocket is not connected');
  }

  private rejectPending(reason: string): void {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timeout);
      entry.reject(new Error(reason));
    }
    this.pending.clear();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== null) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.config.reconnectDelayMs);
    this.reconnectTimer.unref();
  }
}

export const tools = [
  {
    description: 'Return AgentG Gateway connection status for this MCP server.',
    inputSchema: emptyObjectSchema(),
    name: 'agentg_gateway_status'
  },
  {
    description: 'Read buffered Gateway events observed by this MCP server.',
    inputSchema: objectSchema({
      clear: {
        default: false,
        type: 'boolean'
      },
      limit: {
        default: 20,
        minimum: 1,
        type: 'integer'
      }
    }),
    name: 'agentg_gateway_read_events'
  },
  {
    description: 'Read one Telegram chat through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        chatId: {
          minLength: 1,
          type: 'string'
        }
      },
      ['chatId']
    ),
    name: 'telegram_get_chat'
  },
  {
    description: 'Read recent Telegram messages through AgentG Gateway.',
    inputSchema: objectSchema({
      beforeMessageId: {
        minLength: 1,
        type: 'string'
      },
      chatId: {
        minLength: 1,
        type: 'string'
      },
      limit: {
        minimum: 1,
        type: 'integer'
      }
    }),
    name: 'telegram_list_recent_messages'
  },
  {
    description: 'Read or request Telegram messages for a domain owner and selector.',
    inputSchema: objectSchema(
      {
        owner: jsonObjectSchema(),
        selector: jsonObjectSchema()
      },
      ['owner', 'selector']
    ),
    name: 'telegram_get_messages'
  },
  {
    description: 'Search Telegram messages through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        chatId: {
          minLength: 1,
          type: 'string'
        },
        limit: {
          minimum: 1,
          type: 'integer'
        },
        query: {
          minLength: 1,
          type: 'string'
        }
      },
      ['query']
    ),
    name: 'telegram_search_messages'
  },
  {
    description: 'Request a Telegram file for one owner slot through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        owner: jsonObjectSchema(),
        slotKey: {
          minLength: 1,
          type: 'string'
        }
      },
      ['owner', 'slotKey']
    ),
    name: 'telegram_request_file'
  },
  {
    description: 'List Data models known to AgentG Gateway.',
    inputSchema: emptyObjectSchema(),
    name: 'data_list_models'
  },
  {
    description: 'Select a Data dataset through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        limit: {
          minimum: 1,
          type: 'integer'
        },
        model: {
          minLength: 1,
          type: 'string'
        },
        where: jsonValueSchema()
      },
      ['model']
    ),
    name: 'data_select'
  },
  {
    description: 'Get one Data model row by ref through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        ref: jsonObjectSchema()
      },
      ['ref']
    ),
    name: 'data_get'
  },
  {
    description: 'Expand a Data dataset relation through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        from: jsonArraySchema(),
        limit: {
          minimum: 1,
          type: 'integer'
        },
        relation: {
          minLength: 1,
          type: 'string'
        },
        sourceRef: {
          minLength: 1,
          type: 'string'
        },
        where: jsonValueSchema()
      },
      ['from', 'relation', 'sourceRef']
    ),
    name: 'data_expand'
  },
  {
    description: 'Render a Data dataset into text or JSON through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        format: {
          enum: ['text', 'json'],
          type: 'string'
        },
        from: jsonArraySchema(),
        options: jsonValueSchema(),
        sourceRef: {
          minLength: 1,
          type: 'string'
        }
      },
      ['format', 'from', 'sourceRef']
    ),
    name: 'data_render'
  },
  {
    description: 'Read one Data annotation through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        key: {
          minLength: 1,
          type: 'string'
        },
        subject: jsonObjectSchema()
      },
      ['key', 'subject']
    ),
    name: 'data_get_annotation'
  },
  {
    description: 'List Data annotations through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        key: {
          minLength: 1,
          type: 'string'
        },
        subject: jsonObjectSchema()
      },
      ['subject']
    ),
    name: 'data_list_annotations'
  },
  {
    description: 'Write one Data annotation through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        key: {
          minLength: 1,
          type: 'string'
        },
        lineage: jsonArraySchema(),
        mode: {
          enum: ['replace', 'merge'],
          type: 'string'
        },
        subject: jsonObjectSchema(),
        value: jsonValueSchema()
      },
      ['key', 'mode', 'subject', 'value']
    ),
    name: 'data_write_annotation'
  },
  {
    description: 'List one Data collection through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        key: {
          minLength: 1,
          type: 'string'
        },
        subject: jsonObjectSchema()
      },
      ['key', 'subject']
    ),
    name: 'data_list_collection'
  },
  {
    description: 'Read one Data collection item through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        itemId: {
          minLength: 1,
          type: 'string'
        },
        key: {
          minLength: 1,
          type: 'string'
        },
        subject: jsonObjectSchema()
      },
      ['itemId', 'key', 'subject']
    ),
    name: 'data_get_collection_item'
  },
  {
    description: 'Write one Data collection item through AgentG Gateway.',
    inputSchema: collectionItemWriteSchema(),
    name: 'data_write_collection_item'
  },
  {
    description: 'List pipelines through AgentG Gateway.',
    inputSchema: emptyObjectSchema(),
    name: 'pipelines_list_pipelines'
  },
  {
    description: 'Read one pipeline through AgentG Gateway.',
    inputSchema: pipelineNameSchema(),
    name: 'pipelines_get_pipeline'
  },
  {
    description: 'Set one dev/test pipeline document through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        document: {
          anyOf: [jsonObjectSchema(), { minLength: 1, type: 'string' }]
        }
      },
      ['document']
    ),
    name: 'pipelines_set_pipeline'
  },
  {
    description: 'Run one materialized pipeline through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        idempotencyKey: {
          minLength: 1,
          type: 'string'
        },
        name: {
          minLength: 1,
          type: 'string'
        }
      },
      ['name']
    ),
    name: 'pipelines_run_pipeline'
  },
  {
    description: 'Read one pipeline run through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        runId: {
          minLength: 1,
          type: 'string'
        }
      },
      ['runId']
    ),
    name: 'pipelines_get_run'
  },
  {
    description: 'List pipeline runs through AgentG Gateway.',
    inputSchema: objectSchema({
      pipelineName: {
        minLength: 1,
        type: 'string'
      },
      status: {
        enum: ['accepted', 'running', 'waiting', 'completed', 'failed', 'cancelled'],
        type: 'string'
      }
    }),
    name: 'pipelines_list_runs'
  },
  {
    description: 'Delete one pipeline through AgentG Gateway.',
    inputSchema: pipelineNameSchema(),
    name: 'pipelines_delete_pipeline'
  },
  {
    description: 'List policy kinds available through AgentG Gateway.',
    inputSchema: emptyObjectSchema(),
    name: 'policies_list_policy_kinds'
  },
  {
    description: 'List active policy documents through AgentG Gateway.',
    inputSchema: objectSchema({
      kind: {
        minLength: 1,
        type: 'string'
      },
      labels: {
        additionalProperties: {
          type: 'string'
        },
        type: 'object'
      },
      moduleId: {
        minLength: 1,
        type: 'string'
      }
    }),
    name: 'policies_list_instances'
  },
  {
    description: 'Read one policy document through AgentG Gateway.',
    inputSchema: policyIdentitySchema(),
    name: 'policies_get_instance'
  },
  {
    description: 'Read one resolved policy value through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        kind: {
          minLength: 1,
          type: 'string'
        }
      },
      ['kind']
    ),
    name: 'policies_get_policy_value'
  },
  {
    description: 'Set one active policy document through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        document: jsonObjectSchema()
      },
      ['document']
    ),
    name: 'policies_set_instance'
  },
  {
    description: 'Delete one active policy document through AgentG Gateway.',
    inputSchema: policyIdentitySchema(),
    name: 'policies_delete_instance'
  }
];

export async function callTool(name: string, rawArgs: unknown, bridge: ToolBridge) {
  const args = argsOf(rawArgs);
  switch (name) {
    case 'agentg_gateway_status':
      return toolResult(bridge.status());
    case 'agentg_gateway_read_events':
      return toolResult(
        bridge.readEvents({
          clear: optionalBoolean(args, 'clear') ?? false,
          limit: optionalInteger(args, 'limit') ?? 20
        })
      );
    case 'telegram_get_chat':
      return toolResult(
        await bridge.call('telegram.getChat', {
          chatId: requiredString(args, 'chatId')
        })
      );
    case 'telegram_list_recent_messages':
      return toolResult(
        await bridge.call(
          'telegram.listRecentMessages',
          compactObject({
            beforeMessageId: optionalString(args, 'beforeMessageId'),
            chatId: optionalString(args, 'chatId'),
            limit: optionalInteger(args, 'limit')
          })
        )
      );
    case 'telegram_get_messages':
      return toolResult(
        await bridge.call('telegram.getMessages', {
          owner: requiredRecord(args, 'owner'),
          selector: requiredRecord(args, 'selector')
        })
      );
    case 'telegram_search_messages':
      return toolResult(
        await bridge.call(
          'telegram.searchMessages',
          compactObject({
            chatId: optionalString(args, 'chatId'),
            limit: optionalInteger(args, 'limit'),
            query: requiredString(args, 'query')
          })
        )
      );
    case 'telegram_request_file':
      return toolResult(
        await bridge.call('telegram.requestFile', {
          owner: requiredRecord(args, 'owner'),
          slotKey: requiredString(args, 'slotKey')
        })
      );
    case 'data_list_models':
      return toolResult(await bridge.call('data.listModels'));
    case 'data_select':
      return toolResult(
        await bridge.call(
          'data.select',
          compactObject({
            limit: optionalInteger(args, 'limit'),
            model: requiredString(args, 'model'),
            where: optionalValue(args, 'where')
          })
        )
      );
    case 'data_get':
      return toolResult(
        await bridge.call('data.get', {
          ref: requiredRecord(args, 'ref')
        })
      );
    case 'data_expand':
      return toolResult(
        await bridge.call(
          'data.expand',
          compactObject({
            from: requiredArray(args, 'from'),
            limit: optionalInteger(args, 'limit'),
            relation: requiredString(args, 'relation'),
            sourceRef: requiredString(args, 'sourceRef'),
            where: optionalValue(args, 'where')
          })
        )
      );
    case 'data_render':
      return toolResult(
        await bridge.call(
          'data.render',
          compactObject({
            format: requiredString(args, 'format'),
            from: requiredArray(args, 'from'),
            options: optionalValue(args, 'options'),
            sourceRef: requiredString(args, 'sourceRef')
          })
        )
      );
    case 'data_get_annotation':
      return toolResult(
        await bridge.call('data.getAnnotation', {
          key: requiredString(args, 'key'),
          subject: requiredRecord(args, 'subject')
        })
      );
    case 'data_list_annotations':
      return toolResult(
        await bridge.call(
          'data.listAnnotations',
          compactObject({
            key: optionalString(args, 'key'),
            subject: requiredRecord(args, 'subject')
          })
        )
      );
    case 'data_write_annotation':
      return toolResult(
        await bridge.call(
          'data.writeAnnotation',
          compactObject({
            key: requiredString(args, 'key'),
            lineage: optionalArray(args, 'lineage'),
            mode: requiredString(args, 'mode'),
            subject: requiredRecord(args, 'subject'),
            value: requiredValue(args, 'value')
          })
        )
      );
    case 'data_list_collection':
      return toolResult(
        await bridge.call('data.listCollection', {
          key: requiredString(args, 'key'),
          subject: requiredRecord(args, 'subject')
        })
      );
    case 'data_get_collection_item':
      return toolResult(
        await bridge.call('data.getCollectionItem', {
          itemId: requiredString(args, 'itemId'),
          key: requiredString(args, 'key'),
          subject: requiredRecord(args, 'subject')
        })
      );
    case 'data_write_collection_item':
      return toolResult(
        await bridge.call('data.writeCollectionItem', collectionItemWriteParams(args))
      );
    case 'pipelines_list_pipelines':
      return toolResult(await bridge.call('pipelines.listPipelines'));
    case 'pipelines_get_pipeline':
      return toolResult(
        await bridge.call('pipelines.getPipeline', {
          name: requiredString(args, 'name')
        })
      );
    case 'pipelines_set_pipeline':
      return toolResult(
        await bridge.call('pipelines.setPipeline', {
          document: requiredValue(args, 'document')
        })
      );
    case 'pipelines_run_pipeline':
      return toolResult(
        await bridge.call(
          'pipelines.runPipeline',
          compactObject({
            idempotencyKey: optionalString(args, 'idempotencyKey'),
            name: requiredString(args, 'name')
          })
        )
      );
    case 'pipelines_get_run':
      return toolResult(
        await bridge.call('pipelines.getRun', {
          runId: requiredString(args, 'runId')
        })
      );
    case 'pipelines_list_runs':
      return toolResult(
        await bridge.call(
          'pipelines.listRuns',
          compactObject({
            pipelineName: optionalString(args, 'pipelineName'),
            status: optionalString(args, 'status')
          })
        )
      );
    case 'pipelines_delete_pipeline':
      return toolResult(
        await bridge.call('pipelines.deletePipeline', {
          name: requiredString(args, 'name')
        })
      );
    case 'policies_list_policy_kinds':
      return toolResult(await bridge.call('policies.listPolicyKinds'));
    case 'policies_list_instances':
      return toolResult(
        await bridge.call(
          'policies.listInstances',
          compactObject({
            kind: optionalString(args, 'kind'),
            labels: optionalRecord(args, 'labels'),
            moduleId: optionalString(args, 'moduleId')
          })
        )
      );
    case 'policies_get_instance':
      return toolResult(await bridge.call('policies.getInstance', policyIdentity(args)));
    case 'policies_get_policy_value':
      return toolResult(
        await bridge.call('policies.getPolicyValue', {
          kind: requiredString(args, 'kind')
        })
      );
    case 'policies_set_instance':
      return toolResult(
        await bridge.call('policies.setInstance', {
          document: requiredRecord(args, 'document')
        })
      );
    case 'policies_delete_instance':
      return toolResult(await bridge.call('policies.deleteInstance', policyIdentity(args)));
    default:
      throw new Error(`Unknown AgentG Codex MCP tool: ${name}`);
  }
}

if (isMainModule()) {
  await main();
}

async function main(): Promise<void> {
  const bridge = new GatewayBridge(readConfig());
  const server = new Server(
    {
      name: 'agentg-codex',
      version: '0.1.0'
    },
    {
      capabilities: {
        tools: {}
      },
      instructions: [
        'AgentG Codex MCP talks only to AgentG Gateway WebSocket. Use explicit tools; do not invent method names or bypass Gateway.',
        'Policy tools mutate the active policy store through Gateway. Treat set/delete as user-intent operations and inspect results for rejected status.',
        'Telegram tools expose Gateway-approved Telegram reads and file requests. TDLib, storage, coverage, and worker details stay private to AgentG modules.',
        'Data and Pipeline tools expose addressable data operations and pipeline lifecycle through Gateway.'
      ].join('\n')
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, (req) =>
    callTool(req.params.name, req.params.arguments, bridge)
  );

  process.on('SIGINT', () => {
    bridge.stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    bridge.stop();
    process.exit(0);
  });
  process.on('unhandledRejection', (error) => {
    process.stderr.write(`agentg codex mcp: unhandled rejection: ${errorMessage(error)}\n`);
  });
  process.on('uncaughtException', (error) => {
    process.stderr.write(`agentg codex mcp: uncaught exception: ${errorMessage(error)}\n`);
  });

  await server.connect(new StdioServerTransport());
  bridge.start();
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && import.meta.url === pathToFileURL(resolve(entrypoint)).href;
}

function argsOf(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function compactObject(value: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      output[key] = item;
    }
  }
  return output;
}

function collectionItemWriteParams(args: Record<string, unknown>): Record<string, unknown> {
  const mode = requiredString(args, 'mode');
  const base = {
    key: requiredString(args, 'key'),
    lineage: optionalArray(args, 'lineage'),
    mode,
    subject: requiredRecord(args, 'subject'),
    value: requiredValue(args, 'value')
  };

  if (mode === 'append') {
    if (optionalString(args, 'itemId') !== undefined) {
      throw new Error('append mode does not accept itemId');
    }
    return compactObject(base);
  }
  if (mode === 'replace' || mode === 'merge') {
    return compactObject({
      ...base,
      itemId: requiredString(args, 'itemId')
    });
  }

  throw new Error('mode must be append, replace, or merge');
}

function collectionItemWriteSchema(): Record<string, unknown> {
  const shared = {
    key: {
      minLength: 1,
      type: 'string'
    },
    lineage: jsonArraySchema(),
    subject: jsonObjectSchema(),
    value: jsonValueSchema()
  };

  return {
    anyOf: [
      objectSchema(
        {
          ...shared,
          mode: {
            const: 'append',
            type: 'string'
          }
        },
        ['key', 'mode', 'subject', 'value']
      ),
      objectSchema(
        {
          ...shared,
          itemId: {
            minLength: 1,
            type: 'string'
          },
          mode: {
            enum: ['replace', 'merge'],
            type: 'string'
          }
        },
        ['itemId', 'key', 'mode', 'subject', 'value']
      )
    ]
  };
}

function emptyObjectSchema(): Record<string, unknown> {
  return objectSchema({});
}

function debug(message: string): void {
  if (debugEnabled) {
    process.stderr.write(`agentg codex mcp debug: ${message}\n`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function integerEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonObjectSchema(): Record<string, unknown> {
  return {
    additionalProperties: true,
    type: 'object'
  };
}

function jsonArraySchema(): Record<string, unknown> {
  return {
    items: jsonValueSchema(),
    type: 'array'
  };
}

function jsonValueSchema(): Record<string, unknown> {
  return {
    anyOf: [
      { type: 'object', additionalProperties: true },
      { type: 'array' },
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'null' }
    ]
  };
}

function objectSchema(
  properties: Record<string, unknown>,
  required: readonly string[] = []
): Record<string, unknown> {
  return {
    additionalProperties: false,
    properties,
    required,
    type: 'object'
  };
}

function optionalBoolean(args: Record<string, unknown>, name: string): boolean | undefined {
  const value = args[name];
  return typeof value === 'boolean' ? value : undefined;
}

function optionalArray(args: Record<string, unknown>, name: string): unknown[] | undefined {
  const value = args[name];
  return Array.isArray(value) ? value : undefined;
}

function optionalInteger(args: Record<string, unknown>, name: string): number | undefined {
  const value = args[name];
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function optionalRecord(
  args: Record<string, unknown>,
  name: string
): Record<string, unknown> | undefined {
  const value = args[name];
  return isRecord(value) ? value : undefined;
}

function optionalValue(args: Record<string, unknown>, name: string): unknown {
  return Object.hasOwn(args, name) ? args[name] : undefined;
}

function optionalString(args: Record<string, unknown>, name: string): string | undefined;
function optionalString(value: unknown): string | undefined;
function optionalString(argsOrValue: unknown, name?: string): string | undefined {
  const value = name === undefined ? argsOrValue : (argsOrValue as Record<string, unknown>)[name];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function policyIdentity(args: Record<string, unknown>): { kind: string; name: string } {
  return {
    kind: requiredString(args, 'kind'),
    name: requiredString(args, 'name')
  };
}

function pipelineNameSchema(): Record<string, unknown> {
  return objectSchema(
    {
      name: {
        minLength: 1,
        type: 'string'
      }
    },
    ['name']
  );
}

function policyIdentitySchema(): Record<string, unknown> {
  return objectSchema(
    {
      kind: {
        minLength: 1,
        type: 'string'
      },
      name: {
        minLength: 1,
        type: 'string'
      }
    },
    ['kind', 'name']
  );
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

function requiredArray(args: Record<string, unknown>, name: string): unknown[] {
  const value = args[name];
  if (Array.isArray(value)) {
    return value;
  }
  throw new Error(`${name} is required`);
}

function requiredRecord(args: Record<string, unknown>, name: string): Record<string, unknown> {
  const value = args[name];
  if (isRecord(value)) {
    return value;
  }
  throw new Error(`${name} is required`);
}

function requiredString(args: Record<string, unknown>, name: string): string {
  const value = optionalString(args, name);
  if (value !== undefined) {
    return value;
  }
  throw new Error(`${name} is required`);
}

function requiredValue(args: Record<string, unknown>, name: string): unknown {
  if (Object.hasOwn(args, name)) {
    return args[name];
  }
  throw new Error(`${name} is required`);
}

function toolResult(result: unknown) {
  return {
    content: [
      {
        text: JSON.stringify(result, null, 2),
        type: 'text' as const
      }
    ]
  };
}
