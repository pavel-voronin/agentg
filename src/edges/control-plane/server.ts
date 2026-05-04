import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';

import { WebSocket, WebSocketServer } from 'ws';

import type { EventBus } from '../../bus/eventBus.js';
import type { AppEvent } from '../../bus/events.js';
import type { AppPluginRegistry, AppServiceRegistry } from '../../app/createApp.js';
import {
  closeHttpServer,
  closeWebSocketClients,
  closeWebSocketServer,
  isRecord,
  listen,
  normalizeRequestId,
  parseRpcRequest,
  rawDataToString,
  sendRpcResponse
} from '../rpc.js';

export type ControlPlaneServerConfig = {
  enabled: boolean;
  host: string;
  port: number;
  staticDir: string;
};

export type ControlPlaneServerOptions = {
  config: ControlPlaneServerConfig;
  eventBus: EventBus;
  plugins: AppPluginRegistry;
  services: AppServiceRegistry;
};

export type ControlPlaneServerHandle = {
  close(): Promise<void>;
  host: string;
  port: number;
};

type ControlPlaneRuntime = Pick<ControlPlaneServerOptions, 'plugins' | 'services'>;

export async function startControlPlaneServer(
  options: ControlPlaneServerOptions
): Promise<ControlPlaneServerHandle> {
  const runtime: ControlPlaneRuntime = {
    plugins: options.plugins,
    services: options.services
  };
  const staticRoot = resolve(options.config.staticDir);
  const server = createServer((request, response) => {
    void handleHttpRequest(staticRoot, request, response);
  });
  const webSocketServer = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();
  let latestTdlibStatusEvent: AppEvent | undefined;

  server.on('upgrade', (request, socket, head) => {
    if (requestPath(request) !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (client) => {
      webSocketServer.emit('connection', client, request);
    });
  });

  webSocketServer.on('connection', (client) => {
    clients.add(client);
    if (latestTdlibStatusEvent !== undefined) {
      sendEvent(client, latestTdlibStatusEvent);
    }
    client.on('message', (payload) => {
      void handleClientMessage(runtime, client, rawDataToString(payload));
    });
    client.on('close', () => {
      clients.delete(client);
    });
  });

  const subscription = options.eventBus.subscribeAll((event) => {
    if (event.type === 'telegram.tdlib.status') {
      latestTdlibStatusEvent = event;
    }
    broadcast(clients, { event });
  });
  const port = await listen(server, options.config.host, options.config.port);

  return {
    async close(): Promise<void> {
      subscription.unsubscribe();
      closeWebSocketClients(clients);
      await closeWebSocketServer(webSocketServer);
      await closeHttpServer(server);
    },
    host: options.config.host,
    port
  };
}

export function callControlPlaneMethod(
  runtime: ControlPlaneRuntime,
  method: string,
  params: unknown
): unknown {
  if (method === 'app.overview') {
    return {
      plugins: runtime.plugins.registry.list().map((plugin) => plugin.name)
    };
  }

  if (method === 'history.getOverview') {
    return runtime.services.history.getOverview();
  }

  if (method === 'history.listChats') {
    return runtime.services.history.listChats(readHistoryListChatsParams(params));
  }

  if (method === 'history.getChatHistoryState') {
    return runtime.services.history.getChatHistoryState(readStringParam(params, 'chatId'));
  }

  if (method === 'history.upsertTarget') {
    return runtime.services.history.upsertTarget(readHistoryTargetUpsertParams(params));
  }

  if (method === 'history.deleteTarget') {
    return runtime.services.history.deleteTarget(readStringParam(params, 'targetId'));
  }

  if (method === 'history.listMessages') {
    return runtime.services.history.listMessages(readStringParam(params, 'chatId'));
  }

  if (method === 'history.getCoverage') {
    return runtime.services.history.getCoverage(readStringParam(params, 'chatId'));
  }

  if (method === 'summaries.readChatSummary') {
    return runtime.plugins.summaries.readChatSummary(readStringParam(params, 'chatId'));
  }

  throw new Error(`Unknown Control Plane method: ${method}`);
}

async function handleClientMessage(
  runtime: ControlPlaneRuntime,
  client: WebSocket,
  payload: string
): Promise<void> {
  const request = parseRpcRequest(payload);
  if (request === undefined) {
    sendRpcResponse(client, invalidRequest(null, 'Request must be a JSON object'));
    return;
  }

  const id = normalizeRequestId(request.id);
  if (id === null) {
    sendRpcResponse(client, invalidRequest(null, 'Request id must be a string or number'));
    return;
  }

  if (typeof request.method !== 'string') {
    sendRpcResponse(client, invalidRequest(id, 'Request method must be a string'));
    return;
  }

  try {
    sendRpcResponse(client, {
      id,
      result: await callControlPlaneMethod(runtime, request.method, request.params)
    });
  } catch (error) {
    sendRpcResponse(client, {
      id,
      error: {
        code: 'method_failed',
        message: error instanceof Error ? error.message : String(error)
      }
    });
  }
}

async function handleHttpRequest(
  staticRoot: string,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendHttp(response, 405, 'Method Not Allowed');
    return;
  }

  const path = requestPath(request);
  if (path === '/healthz') {
    sendHttp(response, 200, 'ok');
    return;
  }

  const filePath = resolveStaticPath(staticRoot, path);
  if (filePath === null) {
    sendHttp(response, 403, 'Forbidden');
    return;
  }

  const body = await readStaticFile(filePath, staticRoot);
  if (body === null) {
    sendHttp(response, 404, 'Not Found');
    return;
  }

  response.writeHead(200, {
    'content-length': body.byteLength,
    'content-type': contentType(filePath)
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  response.end(body);
}

function broadcast(clients: Set<WebSocket>, message: unknown): void {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function sendEvent(client: WebSocket, event: AppEvent): void {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ event }));
  }
}

async function readStaticFile(filePath: string, staticRoot: string): Promise<Buffer | null> {
  try {
    return await readFile(filePath);
  } catch (error) {
    if (isNotFoundError(error) && filePath !== resolve(staticRoot, 'index.html')) {
      return readStaticFile(resolve(staticRoot, 'index.html'), staticRoot);
    }
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

function resolveStaticPath(staticRoot: string, path: string): string | null {
  const relativePath = path === '/' ? 'index.html' : decodeURIComponent(path.slice(1));
  const candidate = resolve(staticRoot, relativePath);
  const rootWithSeparator = staticRoot.endsWith(sep) ? staticRoot : `${staticRoot}${sep}`;
  if (candidate !== staticRoot && !candidate.startsWith(rootWithSeparator)) {
    return null;
  }

  return candidate;
}

function requestPath(request: IncomingMessage): string {
  return new URL(request.url ?? '/', 'http://localhost').pathname;
}

function contentType(filePath: string): string {
  switch (extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function sendHttp(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    'content-length': Buffer.byteLength(body),
    'content-type': 'text/plain; charset=utf-8'
  });
  response.end(body);
}

function isNotFoundError(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}

function readStringParam(params: unknown, key: string): string {
  if (!isRecord(params)) {
    throw new Error('Params must be an object');
  }

  const value = params[key];
  if (typeof value !== 'string') {
    throw new Error(`Param must be a string: ${key}`);
  }

  return value;
}

function readHistoryListChatsParams(params: unknown): {
  folderId?: number | null;
  limit?: number;
  list?: 'archive' | 'folder' | 'main';
  query?: string;
} {
  if (!isRecord(params)) {
    return {};
  }

  const list = params.list;
  const folderId = params.folderId;
  const limit = params.limit;
  const query = params.query;

  return {
    ...(folderId === null || typeof folderId === 'number' ? { folderId } : {}),
    ...(typeof limit === 'number' ? { limit } : {}),
    ...(list === 'archive' || list === 'folder' || list === 'main' ? { list } : {}),
    ...(typeof query === 'string' ? { query } : {})
  };
}

function readHistoryTargetUpsertParams(params: unknown):
  | {
      chatId: string;
      end: string;
      start: string;
      targetId?: string;
    }
  | {
      chatId: string;
      preset: string;
      targetId?: string;
    } {
  if (!isRecord(params)) {
    throw new Error('Params must be an object');
  }

  const chatId = params.chatId;
  const targetId = params.targetId;
  if (typeof chatId !== 'string' || chatId.length === 0) {
    throw new Error('Param must be a string: chatId');
  }
  if (targetId !== undefined && typeof targetId !== 'string') {
    throw new Error('Param must be a string: targetId');
  }

  if (typeof params.preset === 'string') {
    return {
      chatId,
      preset: params.preset,
      ...(targetId === undefined ? {} : { targetId })
    };
  }

  if (typeof params.start === 'string' && typeof params.end === 'string') {
    return {
      chatId,
      end: params.end,
      start: params.start,
      ...(targetId === undefined ? {} : { targetId })
    };
  }

  throw new Error('history.upsertTarget requires preset or start/end');
}

function invalidRequest(
  id: string | number | null,
  message: string
): {
  error: { code: string; message: string };
  id: string | number | null;
} {
  return {
    id,
    error: {
      code: 'invalid_request',
      message
    }
  };
}
