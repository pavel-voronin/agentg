import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { InternalTrpcClientConfig } from '@agentg/history-sync/rpc';
import type { InternalTrpcClientConfig as TelegramInternalTrpcClientConfig } from '@agentg/telegram/rpc';
import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import type { IntegrationEvent } from '@agentg/shared/events/envelope';
import { WebSocket, WebSocketServer, type RawData } from 'ws';

import {
  createTrpcGatewayHistoryClient,
  type GatewayHistoryClient
} from './history-observability.js';
import { createTrpcGatewayTelegramClient, type GatewayTelegramClient } from './telegram-reads.js';

export type AgentGatewayConfig = {
  host: string;
  port: number;
  token?: string;
};

export type AgentGatewayOptions = {
  config: AgentGatewayConfig;
  eventBus: EventBus;
  services: {
    history: InternalTrpcClientConfig;
    telegram: TelegramInternalTrpcClientConfig;
  };
};

type AgentGatewayRuntime = AgentGatewayOptions & {
  historyClient: GatewayHistoryClient;
  telegramClient: GatewayTelegramClient;
};

type RpcRequest = {
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

type RpcResponse = {
  id: string | number | null;
  error?: {
    code: string;
    message: string;
  };
  result?: unknown;
};

export async function runAgentGateway(options: AgentGatewayOptions): Promise<void> {
  const historyClient = createTrpcGatewayHistoryClient(options.services.history);
  const telegramClient = createTrpcGatewayTelegramClient(options.services.telegram);
  const runtime: AgentGatewayRuntime = {
    ...options,
    historyClient,
    telegramClient
  };
  const server = createServer((request, response) => {
    handleHttpRequest(request, response);
  });
  const webSocketServer = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();

  server.on('upgrade', (request, socket, head) => {
    if (!isAuthorized(request.url, options.config.token)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (client) => {
      webSocketServer.emit('connection', client, request);
    });
  });

  webSocketServer.on('connection', (client) => {
    clients.add(client);

    client.on('message', (payload) => {
      void handleClientMessage(runtime, client, rawDataToString(payload));
    });
    client.on('close', () => {
      clients.delete(client);
    });
  });

  const subscriptions = [
    options.eventBus.subscribe('telegram.>', (event) => {
      broadcast(clients, {
        event
      });
    }),
    options.eventBus.subscribe('history.>', (event) => {
      broadcast(clients, {
        event
      });
    })
  ];

  await listen(server, options.config.host, options.config.port);
  console.log(
    JSON.stringify({
      event: 'agent_gateway.ready',
      host: options.config.host,
      port: options.config.port
    })
  );

  await waitForShutdown(
    server,
    webSocketServer,
    subscriptions,
    options.eventBus,
    historyClient,
    telegramClient
  );
}

async function handleClientMessage(
  options: AgentGatewayRuntime,
  client: WebSocket,
  payload: string
): Promise<void> {
  const request = parseRequest(payload);
  if (request === undefined) {
    sendResponse(client, {
      id: null,
      error: {
        code: 'invalid_request',
        message: 'Request must be a JSON object'
      }
    });
    return;
  }

  const id = normalizeRequestId(request.id);
  if (id === null) {
    sendResponse(client, {
      id: null,
      error: {
        code: 'invalid_request',
        message: 'Request id must be a string or number'
      }
    });
    return;
  }

  if (typeof request.method !== 'string') {
    sendResponse(client, {
      id,
      error: {
        code: 'invalid_request',
        message: 'Request method must be a string'
      }
    });
    return;
  }

  try {
    const result = await callMethod(options, request.method, request.params);
    sendResponse(client, {
      id,
      result
    });
  } catch (error) {
    sendResponse(client, {
      id,
      error: {
        code: 'method_failed',
        message: error instanceof Error ? error.message : String(error)
      }
    });
  }
}

async function callMethod(
  options: AgentGatewayRuntime,
  method: string,
  params: unknown
): Promise<unknown> {
  if (method.startsWith('history.')) {
    const result = await options.historyClient.call(method, params);
    if (result !== undefined) {
      return result;
    }
  }

  if (method.startsWith('telegram.')) {
    const result = await options.telegramClient.call(method, params);
    if (result !== undefined) {
      return result;
    }
  }

  throw new Error(`Unknown method: ${method}`);
}

function handleHttpRequest(request: IncomingMessage, response: ServerResponse): void {
  if (request.method !== 'GET') {
    sendHttp(response, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
    return;
  }

  sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
}

function sendHttp(
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: string
): void {
  response.writeHead(statusCode, {
    'content-length': Buffer.byteLength(body),
    'content-type': contentType
  });
  response.end(body);
}

function isAuthorized(url: string | undefined, token: string | undefined): boolean {
  if (token === undefined || token.length === 0) {
    return true;
  }

  const parsed = new URL(url ?? '/', 'http://localhost');
  return parsed.searchParams.get('token') === token;
}

function parseRequest(payload: string): RpcRequest | undefined {
  try {
    const parsed = JSON.parse(payload) as unknown;
    return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
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

function normalizeRequestId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  return null;
}

function sendResponse(client: WebSocket, response: RpcResponse): void {
  sendJson(client, response);
}

function broadcast(clients: Set<WebSocket>, payload: { event: IntegrationEvent }): void {
  for (const client of clients) {
    sendJson(client, payload);
  }
}

function sendJson(client: WebSocket, payload: unknown): void {
  if (client.readyState !== WebSocket.OPEN) {
    return;
  }

  client.send(JSON.stringify(payload));
}

async function listen(server: Server, host: string, port: number): Promise<void> {
  await new Promise<void>((resolve) => {
    server.listen(port, host, resolve);
  });
}

async function waitForShutdown(
  server: Server,
  webSocketServer: WebSocketServer,
  subscriptions: EventSubscription[],
  eventBus: EventBus,
  historyClient: GatewayHistoryClient,
  telegramClient: GatewayTelegramClient
): Promise<void> {
  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
      historyClient.close();
      telegramClient.close();
      webSocketServer.close();
      server.close(() => {
        void eventBus.close().finally(resolve);
      });
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
