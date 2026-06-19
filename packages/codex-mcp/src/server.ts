#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-deprecated -- MCP stdio server uses the low-level SDK server API. */
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
      'Telegram tools expose Gateway-approved Telegram reads and file requests. TDLib, storage, coverage, and worker details stay private to AgentG modules.'
    ].join('\n')
  }
);

const tools = [
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
    description: 'Resolve Telegram source content for agent processing through AgentG Gateway.',
    inputSchema: objectSchema(
      {
        sourceSelector: jsonObjectSchema()
      },
      ['sourceSelector']
    ),
    name: 'telegram_resolve_source_content'
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

server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = argsOf(req.params.arguments);
  switch (req.params.name) {
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
    case 'telegram_resolve_source_content':
      return toolResult(
        await bridge.call('telegram.resolveSourceContent', {
          sourceSelector: requiredRecord(args, 'sourceSelector')
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
      throw new Error(`Unknown AgentG Codex MCP tool: ${req.params.name}`);
  }
});

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
