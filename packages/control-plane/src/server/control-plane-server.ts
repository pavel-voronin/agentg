import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

import { createHistoryRpcClient } from '@agentg/history-sync/rpc';
import { createServiceDirectoryClient } from '@agentg/service-directory/rpc';
import type { EventBus } from '@agentg/shared/events/bus';
import type { IntegrationEvent } from '@agentg/shared/events/envelope';
import { WebSocket, WebSocketServer, type RawData } from 'ws';

import {
  callControlPlaneReadMethod,
  type ControlPlaneReadModelRuntime
} from './control-plane-read-model.js';
import {
  createServiceDirectoryTelegramDirectoryClient,
  type TelegramDirectoryClient
} from './telegram-client.js';
import { createControlPlaneServiceManifest } from './registrations.js';

type HistoryRpcClient = ReturnType<typeof createHistoryRpcClient>;
type ServiceDirectoryConfig = {
  url: string;
};

export type ControlPlaneServerConfig = {
  host: string;
  port: number;
  serviceUrl: string;
  staticDir: string;
};

export type ControlPlaneServerOptions = {
  config: ControlPlaneServerConfig;
  eventBus: EventBus;
  historyClient?: HistoryRpcClient;
  telegramClient?: TelegramDirectoryClient;
  services?: {
    serviceDirectory: ServiceDirectoryConfig;
  };
};

export type ControlPlaneServerHandle = {
  close(): Promise<void>;
  host: string;
  port: number;
};

type ControlPlaneRuntime = ControlPlaneReadModelRuntime;

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

const CONTROL_PLANE_TELEGRAM_REQUEST_TIMEOUT_MS = 15000;

export async function startControlPlaneServer(
  options: ControlPlaneServerOptions
): Promise<ControlPlaneServerHandle> {
  const serviceDirectory =
    options.historyClient === undefined || options.telegramClient === undefined
      ? createServiceDirectoryClient({
          eventBus: options.eventBus,
          onTopologyFailure: (error) => {
            requestProcessShutdown('control_plane.topology_failure', error);
          },
          url: requireServiceDirectoryConfig(options).url
        })
      : undefined;
  await serviceDirectory?.refresh();
  const historyClient =
    options.historyClient ??
    createServiceDirectoryHistoryClient(requireServiceDirectory(serviceDirectory));
  const telegramClient =
    options.telegramClient ??
    createServiceDirectoryTelegramDirectoryClient(requireServiceDirectory(serviceDirectory), {
      timeoutMs: CONTROL_PLANE_TELEGRAM_REQUEST_TIMEOUT_MS
    });
  const runtime: ControlPlaneRuntime = {
    historyClient,
    telegramClient
  };
  const staticRoot = resolve(options.config.staticDir);
  const server = createServer((request, response) => {
    void handleHttpRequest(staticRoot, request, response);
  });
  const webSocketServer = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();

  server.on('upgrade', (request, socket, head) => {
    const path = requestPath(request);
    if (path !== '/ws') {
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

    client.on('message', (payload) => {
      void handleClientMessage(runtime, client, rawDataToString(payload));
    });
    client.on('close', () => {
      clients.delete(client);
    });
  });

  const subscriptions = [
    options.eventBus.subscribe('>', (event) => {
      broadcast(clients, {
        event
      });
    })
  ];

  await listen(server, options.config.host, options.config.port);
  await serviceDirectory?.join(
    createControlPlaneServiceManifest({ serviceUrl: options.config.serviceUrl })
  );

  return {
    async close(): Promise<void> {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
      historyClient.close();
      telegramClient.close();
      serviceDirectory?.close();
      closeWebSocketClients(clients);
      await closeWebSocketServer(webSocketServer);
      await closeHttpServer(server);
    },
    host: options.config.host,
    port: serverPort(server)
  };
}

function requestProcessShutdown(event: string, error: Error): void {
  console.error(
    JSON.stringify({
      error: error.message,
      event
    })
  );
  process.exitCode = 1;
  process.kill(process.pid, 'SIGTERM');
}

export async function runControlPlaneServer(options: ControlPlaneServerOptions): Promise<void> {
  const handle = await startControlPlaneServer(options);
  console.log(
    JSON.stringify({
      event: 'control_plane.ready',
      host: handle.host,
      port: handle.port
    })
  );

  await waitForShutdown(handle, options.eventBus);
}

async function handleClientMessage(
  runtime: ControlPlaneRuntime,
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
    const result = await callMethod(runtime, request.method, request.params);
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
  runtime: ControlPlaneRuntime,
  method: string,
  params: unknown
): Promise<unknown> {
  const controlPlaneResult = await callControlPlaneReadMethod(runtime, method, params);
  if (controlPlaneResult !== undefined) {
    return controlPlaneResult;
  }

  if (method.startsWith('history.')) {
    const result = await callHistoryMethod(runtime.historyClient, method, params);
    if (result !== undefined) {
      return result;
    }
  }

  throw new Error(`Unknown method: ${method}`);
}

function callHistoryMethod(
  historyClient: HistoryRpcClient,
  method: string,
  params: unknown
): Promise<unknown> {
  switch (method) {
    case 'history.deleteTarget':
      return historyClient.deleteTarget(params);
    case 'history.getChatHistoryState':
      return historyClient.getChatHistoryState(params);
    case 'history.getChatStats':
      return historyClient.getChatStats(params);
    case 'history.getOverview':
      return historyClient.getOverview();
    case 'history.listJobs':
      return historyClient.listJobs(params);
    case 'history.requestSync':
      return historyClient.requestSync(params);
    case 'history.upsertTarget':
      return historyClient.upsertTarget(params);
    default:
      return Promise.resolve(undefined);
  }
}

function createServiceDirectoryHistoryClient(
  resolver: ReturnType<typeof createServiceDirectoryClient>
): HistoryRpcClient {
  const clients = new Map<string, HistoryRpcClient>();

  return {
    close() {
      for (const client of clients.values()) {
        client.close();
      }
      clients.clear();
    },
    deleteTarget(input) {
      return clientFor('history.deleteTarget').deleteTarget(input);
    },
    getChatHistoryState(input) {
      return clientFor('history.getChatHistoryState').getChatHistoryState(input);
    },
    getChatStats(input) {
      return clientFor('history.getChatStats').getChatStats(input);
    },
    getOverview() {
      return clientFor('history.getOverview').getOverview();
    },
    listJobs(input) {
      return clientFor('history.listJobs').listJobs(input);
    },
    requestSync(input) {
      return clientFor('history.requestSync').requestSync(input);
    },
    upsertTarget(input) {
      return clientFor('history.upsertTarget').upsertTarget(input);
    }
  };

  function clientFor(procedure: string): HistoryRpcClient {
    const url = resolver.resolveProcedure(procedure);
    const existing = clients.get(url);
    if (existing !== undefined) {
      return existing;
    }

    const client = createHistoryRpcClient({ url });
    clients.set(url, client);
    return client;
  }
}

function requireServiceDirectoryConfig(options: ControlPlaneServerOptions): ServiceDirectoryConfig {
  const config = options.services?.serviceDirectory;
  if (config === undefined) {
    throw new Error('Control Plane requires Service Directory config');
  }

  return config;
}

function requireServiceDirectory(
  serviceDirectory: ReturnType<typeof createServiceDirectoryClient> | undefined
): ReturnType<typeof createServiceDirectoryClient> {
  if (serviceDirectory === undefined) {
    throw new Error('Control Plane requires Service Directory client');
  }

  return serviceDirectory;
}

async function handleHttpRequest(
  staticRoot: string,
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

  const filePath = resolveStaticPath(staticRoot, path);
  if (filePath === null) {
    sendHttp(response, 403, 'text/plain; charset=utf-8', 'Forbidden');
    return;
  }

  const body = await readStaticFile(filePath, staticRoot);
  if (body === null) {
    sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
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

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
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
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function sendHttp(
  response: ServerResponse,
  statusCode: number,
  contentTypeHeader: string,
  body: string
): void {
  response.writeHead(statusCode, {
    'content-length': Buffer.byteLength(body),
    'content-type': contentTypeHeader
  });
  response.end(body);
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

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve) => {
    server.listen(port, host, resolve);
  });
}

function serverPort(server: Server): number {
  const address = server.address();
  if (typeof address === 'object' && address !== null) {
    return address.port;
  }

  throw new Error('Control Plane server did not expose a TCP port');
}

function closeWebSocketClients(clients: Set<WebSocket>): void {
  for (const client of clients) {
    client.close();
  }
  clients.clear();
}

function closeWebSocketServer(webSocketServer: WebSocketServer): Promise<void> {
  return new Promise((resolve, reject) => {
    webSocketServer.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function closeHttpServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function waitForShutdown(
  handle: ControlPlaneServerHandle,
  eventBus: EventBus
): Promise<void> {
  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      void handle
        .close()
        .then(() => eventBus.close())
        .finally(resolve);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
