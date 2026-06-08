import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';

import {
  callProcedure,
  timeTelemetryOperation,
  type EventBus,
  type EventSubscription,
  type RegistryClient
} from '@agentg/framework';
import { WebSocket, WebSocketServer, type RawData } from 'ws';

// TODO(file-size): Split HTTP serving, WebSocket RPC, module-file proxy, and server lifecycle.
export type ServerConfig = {
  host: string;
  port: number;
  staticDir: string;
};

export type ServerOptions = {
  config: ServerConfig;
  events: EventBus;
  procedures?: Record<string, (input: unknown) => Promise<unknown>>;
  registry: RegistryClient;
};

export type ServerHandle = {
  close(): Promise<void>;
  host: string;
  port: number;
};

type Runtime = {
  procedures: Record<string, (input: unknown) => Promise<unknown>>;
  registry: RegistryClient;
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

const RUNTIME_VUE_PATH = '/control-plane/runtime/vue.js';
const MODULE_FILES_PREFIX = '/control-plane/module-files/';
const MAX_WEBSOCKET_MESSAGE_BYTES = 1_000_000;
const RPC_TIMEOUT_MS = 15_000;
const nodeRequire = createRequire(import.meta.url);
const vueRuntimeFilePath = nodeRequire.resolve('vue/dist/vue.runtime.esm-browser.js');

export async function runServer(options: ServerOptions): Promise<void> {
  const handle = await startServer(options);
  console.log(
    JSON.stringify({
      event: 'control_plane.ready',
      host: handle.host,
      port: handle.port
    })
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
    registry: options.registry,
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
  return timeTelemetryOperation(
    {
      kind: 'control-plane.rpc',
      name: method
    },
    async () => {
      const localProcedure = runtime.procedures[method];
      return localProcedure === undefined
        ? callModuleProcedure(runtime, method, params)
        : localProcedure(params);
    }
  );
}

async function callModuleProcedure(
  runtime: Runtime,
  method: string,
  params: unknown
): Promise<unknown> {
  const snapshot = runtime.registry.getSnapshot();
  const route = procedureRoute(method);
  const moduleRecord = snapshot.modules.find((record) => record.module === route.module);
  if (!moduleRecord?.procedures.includes(route.procedure)) {
    throw new Error(`Procedure is not registered: ${method}`);
  }

  return callProcedure(moduleRecord.rpcUrl, route.procedure, params, { timeoutMs: RPC_TIMEOUT_MS });
}

function procedureRoute(method: string): { module: string; procedure: string } {
  const [moduleName, ...procedureSegments] = method.split('.');
  const procedure = procedureSegments.join('.');
  if (moduleName === undefined || moduleName.length === 0 || procedure.length === 0) {
    throw new Error(`Control Plane method is invalid: ${method}`);
  }

  return {
    module: moduleName,
    procedure
  };
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
    await proxyModuleFile(runtime, path, request.method, response);
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

async function proxyModuleFile(
  runtime: Runtime,
  path: string,
  method: string | undefined,
  response: ServerResponse
): Promise<void> {
  const file = moduleFileFromPath(path);
  if (file === null) {
    sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
    return;
  }

  try {
    const content = requireFileContent(
      await callProcedureByMethod(runtime, `${file.module}.cp.file`, {
        path: file.modulePath
      })
    );
    const body = Buffer.from(content.bodyBase64, 'base64');
    response.writeHead(200, {
      'cache-control': 'private, max-age=3600',
      'content-length': body.byteLength,
      'content-type': content.contentType
    });
    if (method !== 'HEAD') {
      response.end(body);
      return;
    }
    response.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'File not found') {
      sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
      return;
    }
    sendHttp(response, 502, 'text/plain; charset=utf-8', 'Bad Gateway');
  }
}

function moduleFileFromPath(path: string): { module: string; modulePath: string } | null {
  const relativePath = path.slice(MODULE_FILES_PREFIX.length);
  const segments = relativePath.split('/');
  if (segments.length < 2) {
    return null;
  }
  const module = decodeURIComponent(segments[0] ?? '');
  const modulePath = `/${segments
    .slice(1)
    .map((segment) => decodeURIComponent(segment))
    .join('/')}`;
  if (!safeModuleSegment(module) || !safeModuleFilePath(modulePath)) {
    return null;
  }
  return {
    module,
    modulePath
  };
}

function requireFileContent(value: unknown): { bodyBase64: string; contentType: string } {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('bodyBase64' in value) ||
    typeof value.bodyBase64 !== 'string' ||
    !('contentType' in value) ||
    typeof value.contentType !== 'string'
  ) {
    throw new Error('File response is invalid');
  }

  return {
    bodyBase64: value.bodyBase64,
    contentType: value.contentType
  };
}

function safeModuleSegment(segment: string): boolean {
  return (
    segment.length > 0 &&
    !segment.includes('/') &&
    !segment.includes('..') &&
    !segment.includes('\\')
  );
}

function safeModuleFilePath(path: string): boolean {
  return path.startsWith('/') && path.length > 1 && !path.includes('..') && !path.includes('\\');
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
  return new URL(request.url ?? '/', 'http://control-plane.local').pathname;
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
  throw new Error('Control Plane server address is unavailable');
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
