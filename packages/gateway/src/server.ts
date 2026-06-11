import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import {
  createLogger,
  isProcedureInfrastructureError,
  type EventBus,
  type EventEnvelope,
  type EventSubscription
} from '@agentg/framework';
import type { telegramClient } from '@agentg/telegram';
import { WebSocket, WebSocketServer, type RawData } from 'ws';

const EXTERNAL_EVENT_SUBJECT = 'telegram.login.completed';
const MAX_WEBSOCKET_MESSAGE_BYTES = 1_000_000;
const logger = createLogger('gateway');

type ServerConfig = {
  host: string;
  port: number;
  token?: string | undefined;
};

type ChatLookup = Pick<ReturnType<typeof telegramClient>, 'getChat'>;

export type GatewayServerOptions = {
  chatLookup: ChatLookup;
  config: ServerConfig;
  events: EventBus;
};

export type GatewayServerHandle = {
  host: string;
  port: number;
  stop(): Promise<undefined>;
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

export async function startGatewayServer(
  options: GatewayServerOptions
): Promise<GatewayServerHandle> {
  const clients = new Set<WebSocket>();
  const server = createServer(handleHttpRequest);
  const webSocketServer = new WebSocketServer({
    maxPayload: MAX_WEBSOCKET_MESSAGE_BYTES,
    noServer: true
  });
  const subscriptions: EventSubscription[] = [
    options.events.subscribe(EXTERNAL_EVENT_SUBJECT, (event) => {
      broadcast(clients, { event });
    })
  ];

  server.on('upgrade', (request, socket, head) => {
    if (!isAuthorized(request, options.config.token)) {
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
    client.on('error', () => {
      clients.delete(client);
    });
  });

  try {
    const port = await listen(server, options.config.host, options.config.port);
    logger.info(
      {
        event: 'gateway.ready',
        host: options.config.host,
        port
      },
      'gateway ready'
    );

    return {
      host: options.config.host,
      port,
      async stop() {
        await closeGateway(server, webSocketServer, clients, subscriptions);
        return undefined;
      }
    };
  } catch (error) {
    await closeGateway(server, webSocketServer, clients, subscriptions);
    throw error;
  }
}

async function handleClientMessage(
  options: GatewayServerOptions,
  client: WebSocket,
  payload: string
): Promise<void> {
  const request = parseRequest(payload);
  if (request === undefined) {
    sendResponse(client, {
      error: {
        code: 'invalid_request',
        message: 'Request must be a JSON object'
      },
      id: null
    });
    return;
  }

  const id = normalizeRequestId(request.id);
  if (id === null) {
    sendResponse(client, {
      error: {
        code: 'invalid_request',
        message: 'Request id must be a string or number'
      },
      id: null
    });
    return;
  }

  if (typeof request.method !== 'string') {
    sendResponse(client, {
      error: {
        code: 'invalid_request',
        message: 'Request method must be a string'
      },
      id
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
      error: rpcErrorFromUnknown(error),
      id
    });
  }
}

async function callMethod(
  options: GatewayServerOptions,
  method: string,
  params: unknown
): Promise<unknown> {
  if (method === 'telegram.getChat') {
    return options.chatLookup.getChat(requireGetChatParams(params));
  }

  throw new UnknownGatewayMethodError(method);
}

function requireGetChatParams(params: unknown): { chatId: string } {
  if (
    typeof params === 'object' &&
    params !== null &&
    'chatId' in params &&
    typeof params.chatId === 'string' &&
    params.chatId.trim() !== ''
  ) {
    return {
      chatId: params.chatId
    };
  }

  throw new Error('telegram.getChat requires chatId');
}

function rpcErrorFromUnknown(error: unknown): { code: string; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (isDependencyUnavailableError(error)) {
    return {
      code: 'dependency_unavailable',
      message
    };
  }
  if (error instanceof UnknownGatewayMethodError) {
    return {
      code: 'unknown_method',
      message
    };
  }

  return {
    code: 'method_failed',
    message
  };
}

function isDependencyUnavailableError(error: unknown): boolean {
  return isProcedureInfrastructureError(error);
}

class UnknownGatewayMethodError extends Error {
  constructor(method: string) {
    super(`Unknown method: ${method}`);
  }
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

function isAuthorized(request: IncomingMessage, token: string | undefined): boolean {
  if (token === undefined || token.length === 0) {
    return true;
  }

  return bearerToken(request.headers.authorization) === token;
}

function bearerToken(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) {
    return undefined;
  }

  const token = value.slice('Bearer '.length).trim();
  return token.length === 0 ? undefined : token;
}

function parseRequest(payload: string): RpcRequest | undefined {
  try {
    const parsed: unknown = JSON.parse(payload);
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
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

function sendResponse(client: WebSocket, response: RpcResponse): void {
  sendJson(client, response);
}

function broadcast(clients: Set<WebSocket>, payload: { event: EventEnvelope }): void {
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

async function listen(server: Server, host: string, port: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('error', onError);
      reject(error);
    };

    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        resolve(address.port);
        return;
      }

      resolve(port);
    });
  });
}

async function closeGateway(
  server: Server,
  webSocketServer: WebSocketServer,
  clients: Set<WebSocket>,
  subscriptions: readonly EventSubscription[]
): Promise<void> {
  for (const subscription of subscriptions) {
    subscription.unsubscribe();
  }
  for (const client of clients) {
    client.close();
  }
  clients.clear();
  await Promise.all([closeWebSocketServer(webSocketServer), closeHttpServer(server)]);
}

async function closeHttpServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function closeWebSocketServer(webSocketServer: WebSocketServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    webSocketServer.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
