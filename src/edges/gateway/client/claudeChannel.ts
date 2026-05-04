#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-deprecated -- Claude channel notifications use the low-level MCP Server API. */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebSocket, type RawData } from 'ws';

type GatewayRequest = {
  id: number;
  method: string;
  params?: unknown;
};

type GatewayResponse = {
  error?: {
    code: string;
    message: string;
  };
  id: number | null;
  result?: unknown;
};

type GatewayEventPayload = {
  event?: {
    data: Record<string, unknown>;
    id: string;
    occurredAt: string;
    source: string;
    type: string;
    meta?: Record<string, unknown>;
  };
};

type ClaudeChannelConfig = {
  token?: string;
  wsUrl: string;
};

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
      'AgentG Claude channel bridge.',
      'Connects to the AgentG Gateway WebSocket and forwards Gateway events as Claude channel notifications.',
      'The bridge is external to the AgentG runtime.'
    ].join('\n')
  }
);

class AgentGClaudeChannel {
  private nextRpcId = 1;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private webSocket: WebSocket | undefined;
  private readonly pending = new Map<
    number,
    {
      reject(error: Error): void;
      resolve(value: unknown): void;
    }
  >();

  constructor(
    private readonly config: ClaudeChannelConfig,
    private readonly mcpServer: Server
  ) {}

  start(): void {
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.webSocket?.close();
    this.webSocket = undefined;
    this.rejectPending(new Error('AgentG Gateway WebSocket closed'));
  }

  call(method: string, params?: unknown): Promise<unknown> {
    const webSocket = this.webSocket;
    if (webSocket?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('AgentG Gateway WebSocket is not connected'));
    }

    const id = this.nextRpcId;
    this.nextRpcId += 1;
    const request: GatewayRequest = {
      id,
      method,
      ...(params === undefined ? {} : { params })
    };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      webSocket.send(JSON.stringify(request), (error) => {
        if (error !== undefined) {
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  private connect(): void {
    const webSocket = new WebSocket(this.gatewayUrl());
    this.webSocket = webSocket;

    webSocket.on('open', () => {
      process.stderr.write('agentg channel: gateway websocket connected\n');
    });
    webSocket.on('message', (payload) => {
      void this.handleMessage(rawDataToString(payload));
    });
    webSocket.on('close', () => {
      if (this.webSocket === webSocket) {
        this.webSocket = undefined;
      }
      this.rejectPending(new Error('AgentG Gateway WebSocket closed'));
      this.scheduleReconnect();
    });
    webSocket.on('error', (error) => {
      process.stderr.write(`agentg channel: gateway websocket error: ${error.message}\n`);
    });
  }

  private gatewayUrl(): string {
    const url = new URL(this.config.wsUrl);
    if (this.config.token !== undefined) {
      url.searchParams.set('token', this.config.token);
    }
    return url.toString();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== undefined) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, 1000);
    this.reconnectTimer.unref();
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  private async handleMessage(payload: string): Promise<void> {
    const message = parseJsonRecord(payload);
    if (message === undefined) {
      return;
    }

    if (typeof message.id === 'number') {
      this.handleGatewayResponse(message as GatewayResponse);
      return;
    }

    const eventPayload = message as GatewayEventPayload;
    if (eventPayload.event === undefined) {
      return;
    }

    await this.mcpServer.notification({
      method: 'notifications/claude/channel',
      params: {
        content: JSON.stringify(
          {
            data: eventPayload.event.data,
            event: eventPayload.event.type,
            id: eventPayload.event.id,
            meta: eventPayload.event.meta ?? {},
            occurredAt: eventPayload.event.occurredAt,
            source: eventPayload.event.source
          },
          null,
          2
        )
      }
    });
  }

  private handleGatewayResponse(response: GatewayResponse): void {
    if (response.id === null) {
      return;
    }

    const pending = this.pending.get(response.id);
    if (pending === undefined) {
      return;
    }

    this.pending.delete(response.id);
    if (response.error !== undefined) {
      pending.reject(new Error(response.error.message));
      return;
    }
    pending.resolve(response.result);
  }
}

const channel = new AgentGClaudeChannel(readConfig(), server);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: 'list_recent_messages',
      description: 'List recent Telegram messages through AgentG Gateway.',
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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = readRecord(request.params.arguments);

  if (request.params.name === 'list_recent_messages') {
    return toolResult(
      await channel.call('history.listMessages', {
        chatId: readRequiredString(args?.chatId, 'chatId')
      })
    );
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

process.on('SIGINT', () => {
  channel.stop();
  process.exit(0);
});
process.on('SIGTERM', () => {
  channel.stop();
  process.exit(0);
});
process.on('unhandledRejection', (error) => {
  process.stderr.write(`agentg channel: unhandled rejection: ${String(error)}\n`);
});
process.on('uncaughtException', (error) => {
  process.stderr.write(`agentg channel: uncaught exception: ${String(error)}\n`);
});

await server.connect(new StdioServerTransport());
channel.start();

function readConfig(): ClaudeChannelConfig {
  const token = optionalString(process.env.AGENTG_GATEWAY_TOKEN);
  return {
    ...(token === undefined ? {} : { token }),
    wsUrl: new URL(process.env.AGENTG_GATEWAY_WS_URL ?? 'ws://127.0.0.1:8787/').toString()
  };
}

function toolResult(result: unknown): {
  content: {
    text: string;
    type: 'text';
  }[];
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
  };
}

function parseJsonRecord(value: string): Record<string, unknown> | undefined {
  try {
    return readRecord(JSON.parse(value) as unknown);
  } catch {
    return undefined;
  }
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readRequiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
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
