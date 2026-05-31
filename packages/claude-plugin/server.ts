#!/usr/bin/env bun

/* eslint-disable @typescript-eslint/no-deprecated -- Claude channel notifications need the low-level MCP Server API. */
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
  id: JsonRpcId | null;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
};

type GatewayEvent = {
  id: string;
  type: string;
  at: string;
  data?: unknown;
};

type GatewayEventPayload = {
  event?: GatewayEvent;
};

type Config = {
  wsUrl: string;
  token?: string;
};

function readConfig(): Config {
  const token = optionalString(process.env.GATEWAY_TOKEN);

  return {
    wsUrl: new URL(process.env.GATEWAY_WS_URL ?? 'ws://127.0.0.1:8787/').toString(),
    ...(token === undefined ? {} : { token })
  };
}

class AgentGBridge {
  private ws: WebSocket | null = null;
  private nextRequestId = 1;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private readonly pending = new Map<
    JsonRpcId,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  >();

  constructor(
    private readonly config: Config,
    private readonly server: Server
  ) {}

  start(): void {
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.rejectPending('websocket closed');
  }

  async call(method: string, params?: unknown): Promise<unknown> {
    const ws = this.ws;
    if (ws?.readyState !== WebSocket.OPEN) {
      throw new Error('AgentG gateway websocket is not connected');
    }

    const id = this.nextRequestId++;
    const request: GatewayRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      ws.send(JSON.stringify(request), (error) => {
        if (error) {
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  private connect(): void {
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

    ws.on('open', () => {
      process.stderr.write('agentg channel: websocket connected\n');
    });

    ws.on('message', (data) => {
      void this.handleMessage(rawDataToString(data));
    });

    ws.on('close', () => {
      if (this.ws === ws) this.ws = null;
      this.rejectPending('websocket closed');
      this.scheduleReconnect();
    });

    ws.on('error', (error) => {
      process.stderr.write(`agentg channel: websocket error: ${String(error)}\n`);
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
    this.reconnectTimer.unref();
  }

  private rejectPending(reason: string): void {
    for (const entry of this.pending.values()) {
      entry.reject(new Error(reason));
    }
    this.pending.clear();
  }

  private async handleMessage(payloadText: string): Promise<void> {
    const payload = JSON.parse(payloadText) as GatewayResponse | GatewayEventPayload;

    if ('id' in payload && payload.id !== null) {
      const pending = this.pending.get(payload.id);
      if (!pending) return;
      this.pending.delete(payload.id);
      if (payload.error) {
        pending.reject(new Error(payload.error.message));
      } else {
        pending.resolve(payload.result);
      }
      return;
    }

    const event = 'event' in payload ? payload.event : undefined;
    if (!event) return;

    await this.server.notification({
      method: 'notifications/claude/channel',
      params: {
        content: JSON.stringify(
          {
            event: event.type,
            at: event.at,
            id: event.id,
            data: event.data
          },
          null,
          2
        )
      }
    });
  }
}

const server = new Server(
  { name: 'agentg', version: '0.1.0' },
  {
    capabilities: {
      tools: {},
      experimental: {
        'claude/channel': {}
      }
    },
    instructions: [
      'This plugin bridges AgentG Telegram client gateway into Claude Code.',
      'Incoming Telegram gateway events arrive as Claude channel notifications.',
      'The plugin is intentionally thin; event selection and available gateway behavior are owned by AgentG Gateway.'
    ].join('\n')
  }
);

function toolResult(result: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }

  throw new Error(`${name} is required`);
}

function rawDataToString(payload: RawData): string {
  if (Buffer.isBuffer(payload)) {
    return payload.toString('utf8');
  }

  if (Array.isArray(payload)) {
    return Buffer.concat(payload).toString('utf8');
  }

  return Buffer.from(payload).toString('utf8');
}

const bridge = new AgentGBridge(readConfig(), server);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: 'get_chat',
      description: 'Read one Telegram chat from AgentG Gateway.',
      inputSchema: {
        type: 'object',
        properties: {
          chatId: { type: 'string' }
        },
        required: ['chatId']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = req.params.arguments ?? {};

  switch (req.params.name) {
    case 'get_chat':
      return toolResult(
        await bridge.call('telegram.getChat', {
          chatId: requiredString(args.chatId, 'chatId')
        })
      );
    default:
      throw new Error(`unknown tool: ${req.params.name}`);
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
  process.stderr.write(`agentg channel: unhandled rejection: ${String(error)}\n`);
});
process.on('uncaughtException', (error) => {
  process.stderr.write(`agentg channel: uncaught exception: ${String(error)}\n`);
});

await server.connect(new StdioServerTransport());
bridge.start();
