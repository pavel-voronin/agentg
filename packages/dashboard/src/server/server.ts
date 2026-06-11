import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';

import {
  createLogger,
  timeTelemetrySpan,
  type EventBus,
  type EventSubscription
} from '@agentg/framework';
import { SpanKind } from '@opentelemetry/api';
import {
  ATTR_RPC_METHOD,
  ATTR_RPC_SERVICE,
  ATTR_RPC_SYSTEM_NAME,
  METRIC_RPC_SERVER_CALL_DURATION,
  RPC_SYSTEM_NAME_VALUE_JSONRPC
} from '@opentelemetry/semantic-conventions/incubating';
import { WebSocket, WebSocketServer, type RawData } from 'ws';

export type ServerConfig = {
  host: string;
  port: number;
  staticDir: string;
};

export type ServerOptions = {
  config: ServerConfig;
  events: EventBus;
  procedures?: Record<string, (input: unknown) => Promise<unknown>>;
};

export type ServerHandle = {
  close(): Promise<void>;
  host: string;
  port: number;
};

type Runtime = {
  procedures: Record<string, (input: unknown) => Promise<unknown>>;
  vueRuntimeFilePath: string;
};

type StaticFile = {
  body: Buffer;
  filePath: string;
};

type RpcRequest = {
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

const RUNTIME_VUE_PATH = '/dashboard/runtime/vue.js';
const MODULE_FILES_PREFIX = '/dashboard/module-files/';
const MAX_WEBSOCKET_MESSAGE_BYTES = 1_000_000;
const nodeRequire = createRequire(import.meta.url);
const vueRuntimeFilePath = nodeRequire.resolve('vue/dist/vue.runtime.esm-browser.js');
const logger = createLogger('dashboard-server');

export async function runServer(options: ServerOptions): Promise<void> {
  const handle = await startServer(options);
  logger.info(
    {
      event: 'dashboard.ready',
      host: handle.host,
      port: handle.port
    },
    'dashboard ready'
  );

  await new Promise<void>((resolve) => {
    const stop = (): void => {
      void handle.close().then(resolve);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}

export async function startServer(options: ServerOptions): Promise<ServerHandle> {
  const clients = new Set<WebSocket>();
  const runtime: Runtime = {
    procedures: options.procedures ?? {},
    vueRuntimeFilePath
  };
  const staticRoot = resolve(options.config.staticDir);
  const server = createServer((request, response) => {
    void handleHttpRequest(staticRoot, runtime, request, response);
  });
  const sockets = new WebSocketServer({
    maxPayload: MAX_WEBSOCKET_MESSAGE_BYTES,
    noServer: true
  });
  const subscriptions: EventSubscription[] = [
    options.events.subscribe('>', (event) => {
      broadcast(clients, {
        event: {
          ...('data' in event ? { data: event.data } : {}),
          id: event.id,
          occurredAt: event.at,
          type: event.type
        }
      });
    })
  ];

  server.on('upgrade', (request, socket, head) => {
    if (requestPath(request) !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    sockets.handleUpgrade(request, socket, head, (client) => {
      sockets.emit('connection', client, request);
    });
  });

  sockets.on('connection', (client) => {
    clients.add(client);
    client.on('message', (payload) => {
      void handleClientMessage(runtime, client, rawDataToString(payload));
    });
    client.on('close', () => {
      clients.delete(client);
    });
    client.on('error', () => {
      clients.delete(client);
    });
  });

  await listen(server, options.config.host, options.config.port);

  return {
    async close(): Promise<void> {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
      closeWebSocketClients(clients);
      await closeWebSocketServer(sockets);
      await closeHttpServer(server);
    },
    host: options.config.host,
    port: serverPort(server)
  };
}

async function handleClientMessage(
  runtime: Runtime,
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
    const result = await callProcedureByMethod(runtime, request.method, request.params);
    sendResponse(client, {
      id,
      result
    });
  } catch (error) {
    sendResponse(client, {
      error: {
        code: 'method_failed',
        message: error instanceof Error ? error.message : String(error)
      },
      id
    });
  }
}

async function callProcedureByMethod(
  runtime: Runtime,
  method: string,
  params: unknown
): Promise<unknown> {
  const attributes = {
    [ATTR_RPC_METHOD]: method,
    [ATTR_RPC_SERVICE]: 'dashboard',
    [ATTR_RPC_SYSTEM_NAME]: RPC_SYSTEM_NAME_VALUE_JSONRPC
  };
  return timeTelemetrySpan(
    {
      attributes,
      kind: SpanKind.SERVER,
      metric: {
        attributes,
        name: METRIC_RPC_SERVER_CALL_DURATION
      },
      name: method
    },
    async () => {
      const localProcedure = runtime.procedures[method];
      if (localProcedure === undefined) {
        throw new Error(`Dashboard procedure is not registered: ${method}`);
      }

      return localProcedure(params);
    }
  );
}

async function handleHttpRequest(
  staticRoot: string,
  runtime: Runtime,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendHttp(response, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
    return;
  }

  const path = requestPath(request);
  if (path === '/healthz') {
    sendHttp(response, 200, 'text/plain; charset=utf-8', 'ok');
    return;
  }
  if (path === RUNTIME_VUE_PATH) {
    await sendFile(response, request.method, runtime.vueRuntimeFilePath);
    return;
  }
  if (path.startsWith(MODULE_FILES_PREFIX)) {
    sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
    return;
  }

  const filePath = resolveStaticPath(staticRoot, path);
  if (filePath === null) {
    sendHttp(response, 403, 'text/plain; charset=utf-8', 'Forbidden');
    return;
  }

  const file = await readStaticFile(filePath, staticRoot);
  if (file === null) {
    sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
    return;
  }

  response.writeHead(200, {
    'content-length': file.body.byteLength,
    'content-type': contentType(file.filePath)
  });
  if (request.method !== 'HEAD') {
    response.end(file.body);
    return;
  }
  response.end();
}

async function sendFile(
  response: ServerResponse,
  method: string | undefined,
  filePath: string
): Promise<void> {
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-length': body.byteLength,
      'content-type': contentType(filePath)
    });
    if (method !== 'HEAD') {
      response.end(body);
      return;
    }
    response.end();
  } catch (error) {
    if (isNotFoundError(error)) {
      sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
      return;
    }
    throw error;
  }
}

async function readStaticFile(filePath: string, staticRoot: string): Promise<StaticFile | null> {
  try {
    return {
      body: await readFile(filePath),
      filePath
    };
  } catch (error) {
    if (
      isNotFoundError(error) &&
      extname(filePath).length === 0 &&
      filePath !== resolve(staticRoot, 'index.html')
    ) {
      return readStaticFile(resolve(staticRoot, 'index.html'), staticRoot);
    }
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

function resolveStaticPath(staticRoot: string, path: string): string | null {
  const requested = path === '/' ? '/index.html' : path;
  const resolved = resolve(staticRoot, `.${requested}`);
  return resolved === staticRoot || resolved.startsWith(`${staticRoot}${sep}`) ? resolved : null;
}

function sendHttp(
  response: ServerResponse,
  status: number,
  contentTypeHeader: string,
  body: string
): void {
  const payload = Buffer.from(body);
  response.writeHead(status, {
    'content-length': payload.byteLength,
    'content-type': contentTypeHeader
  });
  response.end(payload);
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

function parseRequest(payload: string): RpcRequest | undefined {
  try {
    const parsed: unknown = JSON.parse(payload);
    return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function normalizeRequestId(id: unknown): string | number | null {
  return typeof id === 'string' || typeof id === 'number' ? id : null;
}

function sendResponse(client: WebSocket, response: unknown): void {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(response));
  }
}

function broadcast(clients: Set<WebSocket>, message: unknown): void {
  for (const client of clients) {
    sendResponse(client, message);
  }
}

function rawDataToString(payload: RawData): string {
  if (Array.isArray(payload)) {
    return Buffer.concat(payload).toString('utf8');
  }
  if (payload instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(payload)).toString('utf8');
  }
  return Buffer.from(payload).toString('utf8');
}

function requestPath(request: IncomingMessage): string {
  return new URL(request.url ?? '/', 'http://dashboard.local').pathname;
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolveListen();
    });
  });
}

function serverPort(server: Server): number {
  const address = server.address();
  if (typeof address === 'object' && address !== null) {
    return address.port;
  }
  throw new Error('Dashboard server address is unavailable');
}

function closeWebSocketClients(clients: Set<WebSocket>): void {
  for (const client of clients) {
    client.close();
  }
  clients.clear();
}

function closeWebSocketServer(server: WebSocketServer): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolveClose();
    });
  });
}

function closeHttpServer(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolveClose();
    });
  });
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
