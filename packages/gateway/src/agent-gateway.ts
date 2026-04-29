import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AppDatabase } from '@agentg/database/client';
import { telegramChats, telegramMessages } from '@agentg/database/schema';
import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import type { IntegrationEvent } from '@agentg/shared/events/envelope';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { WebSocket, WebSocketServer, type RawData } from 'ws';

import { callHistoryMethod } from './history-observability.js';

const gatewayModuleDirectory = dirname(fileURLToPath(import.meta.url));
const uiDistDirectory =
  basename(gatewayModuleDirectory) === 'dist'
    ? join(gatewayModuleDirectory, 'ui')
    : join(gatewayModuleDirectory, '..', 'dist', 'ui');

export type AgentGatewayConfig = {
  host: string;
  port: number;
  token?: string;
};

export type AgentGatewayOptions = {
  config: AgentGatewayConfig;
  database: AppDatabase;
  eventBus: EventBus;
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
  const server = createServer((request, response) => {
    handleHttpRequest(options.config, request, response);
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
      void handleClientMessage(options, client, rawDataToString(payload));
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

  await waitForShutdown(server, webSocketServer, subscriptions, options.eventBus);
}

async function handleClientMessage(
  options: AgentGatewayOptions,
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
  options: AgentGatewayOptions,
  method: string,
  params: unknown
): Promise<unknown> {
  if (method.startsWith('history.')) {
    const result = await callHistoryMethod(options, method, params);
    if (result !== undefined) {
      return result;
    }
  }

  if (method === 'telegram.getMessage') {
    return getMessage(options.database, params);
  }

  if (method === 'telegram.listRecentMessages') {
    return listRecentMessages(options.database, params);
  }

  if (method === 'telegram.searchMessages') {
    return searchMessages(options.database, params);
  }

  if (method === 'telegram.getChat') {
    return getChat(options.database, params);
  }

  throw new Error(`Unknown method: ${method}`);
}

async function getMessage(database: AppDatabase, params: unknown): Promise<unknown> {
  const input = asRecord(params);
  const chatId = asString(input?.chatId);
  const messageId = asString(input?.messageId);
  if (chatId === undefined || messageId === undefined) {
    throw new Error('telegram.getMessage requires chatId and messageId');
  }

  const rows = await database
    .select()
    .from(telegramMessages)
    .where(
      and(
        eq(telegramMessages.telegramChatId, chatId),
        eq(telegramMessages.telegramMessageId, messageId)
      )
    )
    .limit(1);

  return {
    message: rows[0] ?? null
  };
}

async function listRecentMessages(database: AppDatabase, params: unknown): Promise<unknown> {
  const input = asRecord(params);
  const chatId = asString(input?.chatId);
  const limit = parseLimit(input?.limit, 50, 200);

  const where = chatId === undefined ? undefined : eq(telegramMessages.telegramChatId, chatId);
  const rows = await database
    .select()
    .from(telegramMessages)
    .where(where)
    .orderBy(
      desc(telegramMessages.messageDate),
      sql`${telegramMessages.telegramMessageId}::bigint desc`
    )
    .limit(limit);

  return {
    messages: rows
  };
}

async function searchMessages(database: AppDatabase, params: unknown): Promise<unknown> {
  const input = asRecord(params);
  const query = asString(input?.query);
  if (query === undefined || query.trim().length === 0) {
    throw new Error('telegram.searchMessages requires query');
  }

  const chatId = asString(input?.chatId);
  const limit = parseLimit(input?.limit, 20, 100);
  const textFilter = ilike(telegramMessages.text, `%${query.trim()}%`);
  const where =
    chatId === undefined
      ? textFilter
      : and(eq(telegramMessages.telegramChatId, chatId), textFilter);

  const rows = await database
    .select()
    .from(telegramMessages)
    .where(where)
    .orderBy(
      desc(telegramMessages.messageDate),
      sql`${telegramMessages.telegramMessageId}::bigint desc`
    )
    .limit(limit);

  return {
    messages: rows
  };
}

async function getChat(database: AppDatabase, params: unknown): Promise<unknown> {
  const input = asRecord(params);
  const chatId = asString(input?.chatId);
  if (chatId === undefined) {
    throw new Error('telegram.getChat requires chatId');
  }

  const rows = await database
    .select()
    .from(telegramChats)
    .where(eq(telegramChats.telegramChatId, chatId))
    .limit(1);

  return {
    chat: rows[0] ?? null
  };
}

function handleHttpRequest(
  config: AgentGatewayConfig,
  request: IncomingMessage,
  response: ServerResponse
): void {
  const parsed = new URL(request.url ?? '/', 'http://localhost');
  if (request.method !== 'GET') {
    sendHttp(response, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
    return;
  }

  if (parsed.pathname === '/ui' || parsed.pathname === '/ui/') {
    if (!isAuthorized(request.url, config.token)) {
      sendHttp(response, 401, 'text/plain; charset=utf-8', 'Unauthorized');
      return;
    }

    sendUiAsset(response, 'index.html');
    return;
  }

  if (parsed.pathname.startsWith('/ui/')) {
    sendUiAsset(response, parsed.pathname.slice('/ui/'.length));
    return;
  }

  sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
}

function sendUiAsset(response: ServerResponse, relativePath: string): void {
  const assetPath = resolveUiAssetPath(relativePath.length === 0 ? 'index.html' : relativePath);
  if (assetPath === undefined) {
    sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
    return;
  }

  try {
    sendHttp(response, 200, contentTypeForPath(assetPath), readFileSync(assetPath));
  } catch {
    sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
  }
}

function resolveUiAssetPath(relativePath: string): string | undefined {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(relativePath);
  } catch {
    return undefined;
  }

  const normalizedPath = normalize(decodedPath);
  if (normalizedPath === '.' || normalizedPath.startsWith('..') || isAbsolute(normalizedPath)) {
    return undefined;
  }

  return join(uiDistDirectory, normalizedPath);
}

function contentTypeForPath(path: string): string {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

function sendHttp(
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: Buffer | string
): void {
  response.writeHead(statusCode, {
    'content-length': typeof body === 'string' ? Buffer.byteLength(body) : body.byteLength,
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

function parseLimit(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return fallback;
  }

  return Math.min(value, max);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
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
  eventBus: EventBus
): Promise<void> {
  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
      webSocketServer.close();
      server.close(() => {
        void eventBus.close().finally(resolve);
      });
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
