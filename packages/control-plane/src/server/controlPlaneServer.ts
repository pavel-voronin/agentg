import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';

import {
  controlPlaneProviderManifestFromRegistration,
  parseControlPlaneProviderRegistration,
  type ControlPlaneProviderCatalogResponse
} from '@agentg/control-plane-sdk/manifest';
import { createInternalTrpcProcedureProxy } from '@agentg/framework';
import {
  createServiceDirectoryClient,
  type ServiceDirectoryClient
} from '@agentg/service-directory/rpc';
import type { EventBus, EventSubscription } from '@agentg/events/bus';
import type { IntegrationEvent } from '@agentg/events/envelope';
import { WebSocket, WebSocketServer, type RawData } from 'ws';

import {
  CONTROL_PLANE_EVENT_CATALOG_PATH,
  eventCatalogFromServiceDirectorySnapshot
} from '../control-plane/eventCatalog.js';
import type { EventCatalogState } from '../stores/controlPlaneTypes.js';
import { createControlPlaneServiceManifest } from './registrations.js';

type ServiceDirectoryConfig = {
  url: string;
};

export type ControlPlaneServerConfig = {
  host: string;
  port: number;
  runtimeVueBuild: ControlPlaneRuntimeVueBuild;
  serviceUrl: string;
  staticDir: string;
};

export type ControlPlaneRuntimeVueBuild = 'development' | 'production';

export type ControlPlaneServerOptions = {
  config: ControlPlaneServerConfig;
  eventBus: EventBus;
  procedureProxy?: ControlPlaneProcedureProxy;
  serviceDirectory?: ServiceDirectoryClient;
  services?: {
    serviceDirectory: ServiceDirectoryConfig;
  };
};

export type ControlPlaneServerHandle = {
  close(): Promise<void>;
  host: string;
  port: number;
};

export type ControlPlaneProcedureProxy = {
  call(method: string, params: unknown): Promise<unknown>;
  close(): void;
};

type ControlPlaneRuntime = {
  procedureProxy: ControlPlaneProcedureProxy;
  serviceDirectory?: ServiceDirectoryClient;
  vueRuntimeFilePath: string;
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

const CONTROL_PLANE_RPC_REQUEST_TIMEOUT_MS = 15000;
const CONTROL_PLANE_CONTENT_CATALOG_PATH = '/control-plane/content-catalog';
const CONTROL_PLANE_PROVIDER_ASSETS_PREFIX = '/control-plane/provider-assets/';
const CONTROL_PLANE_PROVIDER_FILES_PREFIX = '/control-plane/provider-files/';
const CONTROL_PLANE_RUNTIME_VUE_PATH = '/control-plane/runtime/vue.js';
const nodeRequire = createRequire(import.meta.url);
const vueRuntimeFilePaths = {
  development: nodeRequire.resolve('vue/dist/vue.runtime.esm-browser.js'),
  production: nodeRequire.resolve('vue/dist/vue.runtime.esm-browser.prod.js')
} satisfies Record<ControlPlaneRuntimeVueBuild, string>;

export async function startControlPlaneServer(
  options: ControlPlaneServerOptions
): Promise<ControlPlaneServerHandle> {
  let procedureProxy: ControlPlaneProcedureProxy | undefined;
  let server: Server | undefined;
  let serverListening = false;
  let webSocketServer: WebSocketServer | undefined;
  const clients = new Set<WebSocket>();
  let subscriptions: EventSubscription[] = [];
  const serviceDirectory =
    options.serviceDirectory ??
    (options.procedureProxy === undefined
      ? createServiceDirectoryClient({
          eventBus: options.eventBus,
          onTopologyFailure: (error) => {
            requestProcessShutdown('control_plane.topology_failure', error);
          },
          url: requireServiceDirectoryConfig(options).url
        })
      : undefined);

  try {
    await serviceDirectory?.refresh();
    procedureProxy =
      options.procedureProxy ??
      createInternalTrpcProcedureProxy(requireServiceDirectory(serviceDirectory), {
        timeoutMs: CONTROL_PLANE_RPC_REQUEST_TIMEOUT_MS
      });
    const runtime: ControlPlaneRuntime = {
      procedureProxy,
      ...(serviceDirectory === undefined ? {} : { serviceDirectory }),
      vueRuntimeFilePath: vueRuntimeFilePaths[options.config.runtimeVueBuild]
    };
    const staticRoot = resolve(options.config.staticDir);
    server = createServer((request, response) => {
      void handleHttpRequest(staticRoot, runtime, request, response);
    });
    const createdWebSocketServer = new WebSocketServer({ noServer: true });
    webSocketServer = createdWebSocketServer;

    server.on('upgrade', (request, socket, head) => {
      const path = requestPath(request);
      if (path !== '/ws') {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      createdWebSocketServer.handleUpgrade(request, socket, head, (client) => {
        createdWebSocketServer.emit('connection', client, request);
      });
    });

    createdWebSocketServer.on('connection', (client) => {
      clients.add(client);

      client.on('message', (payload) => {
        void handleClientMessage(runtime, client, rawDataToString(payload));
      });
      client.on('close', () => {
        clients.delete(client);
      });
    });

    subscriptions = [
      options.eventBus.subscribe('>', (event) => {
        broadcast(clients, {
          event
        });
      })
    ];

    await listen(server, options.config.host, options.config.port);
    serverListening = true;
    await serviceDirectory?.join(
      createControlPlaneServiceManifest({ serviceUrl: options.config.serviceUrl })
    );
    const activeProcedureProxy = requireStartedResource(
      procedureProxy,
      'Control Plane procedure proxy'
    );
    const activeServer = requireStartedResource(server, 'Control Plane HTTP server');
    const activeWebSocketServer = requireStartedResource(
      webSocketServer,
      'Control Plane WebSocket server'
    );

    return {
      async close(): Promise<void> {
        for (const subscription of subscriptions) {
          subscription.unsubscribe();
        }
        activeProcedureProxy.close();
        serviceDirectory?.close();
        closeWebSocketClients(clients);
        await closeWebSocketServer(activeWebSocketServer);
        await closeHttpServer(activeServer);
      },
      host: options.config.host,
      port: serverPort(activeServer)
    };
  } catch (error) {
    await cleanupControlPlaneStartupFailure({
      clients,
      procedureProxy,
      server,
      serverListening,
      serviceDirectory,
      subscriptions,
      webSocketServer
    });
    throw error;
  }
}

function requireStartedResource<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(`${name} did not start`);
  }

  return value;
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
  let handle: ControlPlaneServerHandle | undefined;
  try {
    handle = await startControlPlaneServer(options);
    console.log(
      JSON.stringify({
        event: 'control_plane.ready',
        host: handle.host,
        port: handle.port
      })
    );

    await waitForShutdown(handle, options.eventBus);
  } catch (error) {
    if (handle === undefined) {
      await cleanupControlPlaneEventBusStartupFailure(options.eventBus);
    }
    throw error;
  }
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
    const result = await runtime.procedureProxy.call(request.method, request.params);
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

function requireServiceDirectoryConfig(options: ControlPlaneServerOptions): ServiceDirectoryConfig {
  const config = options.services?.serviceDirectory;
  if (config === undefined) {
    throw new Error('Control Plane requires Service Directory config');
  }

  return config;
}

function requireServiceDirectory(
  serviceDirectory: ServiceDirectoryClient | undefined
): ServiceDirectoryClient {
  if (serviceDirectory === undefined) {
    throw new Error('Control Plane requires Service Directory client');
  }

  return serviceDirectory;
}

async function handleHttpRequest(
  staticRoot: string,
  runtime: ControlPlaneRuntime,
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
  if (path === CONTROL_PLANE_RUNTIME_VUE_PATH) {
    await sendFile(response, request.method, runtime.vueRuntimeFilePath);
    return;
  }
  if (path === CONTROL_PLANE_CONTENT_CATALOG_PATH) {
    sendJsonHttp(response, request.method, await controlPlaneContentCatalog(runtime));
    return;
  }
  if (path === CONTROL_PLANE_EVENT_CATALOG_PATH) {
    sendJsonHttp(response, request.method, await controlPlaneEventCatalog(runtime));
    return;
  }
  if (path.startsWith(CONTROL_PLANE_PROVIDER_ASSETS_PREFIX)) {
    await proxyProviderAsset(runtime, path, request, response);
    return;
  }
  if (path.startsWith(CONTROL_PLANE_PROVIDER_FILES_PREFIX)) {
    await proxyProviderFile(runtime, path, request, response);
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

async function proxyProviderFile(
  runtime: ControlPlaneRuntime,
  path: string,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const serviceDirectory = runtime.serviceDirectory;
  if (serviceDirectory === undefined) {
    sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
    return;
  }
  const file = providerFileFromPath(path);
  if (file === null) {
    sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
    return;
  }

  const service = serviceDirectory.getSnapshot().services.find((item) => item.slug === file.slug);
  if (service === undefined) {
    sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
    return;
  }

  try {
    const fetchOptions: RequestInit =
      typeof request.headers.range === 'string'
        ? {
            headers: { range: request.headers.range },
            method: request.method ?? 'GET'
          }
        : {
            method: request.method ?? 'GET'
          };
    const upstream = await fetch(
      providerRpcFileUrl(service.rpcUrl, file.providerPath),
      fetchOptions
    );
    const body = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      'accept-ranges': upstream.headers.get('accept-ranges') ?? 'bytes',
      'cache-control': upstream.headers.get('cache-control') ?? 'private, max-age=3600',
      'content-length': body.byteLength,
      'content-type': upstream.headers.get('content-type') ?? contentType(file.providerPath)
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    response.end(body);
  } catch (error) {
    console.warn(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: 'control_plane.provider_file_proxy_failed',
        provider: file.slug
      })
    );
    sendHttp(response, 502, 'text/plain; charset=utf-8', 'Bad Gateway');
  }
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
    if (method === 'HEAD') {
      response.end();
      return;
    }
    response.end(body);
  } catch (error) {
    if (isNotFoundError(error)) {
      sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
      return;
    }
    throw error;
  }
}

async function controlPlaneContentCatalog(
  runtime: ControlPlaneRuntime
): Promise<ControlPlaneProviderCatalogResponse> {
  const serviceDirectory = runtime.serviceDirectory;
  if (serviceDirectory === undefined) {
    return {
      providers: [],
      version: 0
    };
  }

  try {
    await serviceDirectory.refresh();
  } catch (error) {
    console.warn(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: 'control_plane.provider_catalog_refresh_failed'
      })
    );
  }

  const snapshot = serviceDirectory.getSnapshot();
  return {
    providers: snapshot.services.flatMap((service) => {
      if (service.controlPlane === undefined) {
        return [];
      }
      const registration = parseControlPlaneProviderRegistration(service.controlPlane);
      if (registration === null) {
        console.warn(
          JSON.stringify({
            event: 'control_plane.provider_manifest_invalid',
            service: service.slug
          })
        );
        return [];
      }

      return controlPlaneProviderManifestFromRegistration(
        service.slug,
        registration,
        (assetPath, assetVersion) => providerAssetProxyUrl(service.slug, assetVersion, assetPath)
      );
    }),
    version: snapshot.version
  };
}

async function controlPlaneEventCatalog(runtime: ControlPlaneRuntime): Promise<EventCatalogState> {
  const serviceDirectory = runtime.serviceDirectory;
  if (serviceDirectory === undefined) {
    return {
      services: [],
      version: 0
    };
  }

  try {
    await serviceDirectory.refresh();
  } catch (error) {
    console.warn(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: 'control_plane.event_catalog_refresh_failed'
      })
    );
  }

  return eventCatalogFromServiceDirectorySnapshot(serviceDirectory.getSnapshot());
}

async function proxyProviderAsset(
  runtime: ControlPlaneRuntime,
  path: string,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const serviceDirectory = runtime.serviceDirectory;
  if (serviceDirectory === undefined) {
    sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
    return;
  }
  const asset = providerAssetFromPath(path);
  if (asset === null) {
    sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
    return;
  }

  const service = serviceDirectory.getSnapshot().services.find((item) => item.slug === asset.slug);
  if (service?.controlPlane === undefined) {
    sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
    return;
  }
  const registration = parseControlPlaneProviderRegistration(service.controlPlane);
  if (registration === null || !providerAssetVersionActive(registration, asset)) {
    sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
    return;
  }

  try {
    const upstream = await fetch(providerRpcAssetUrl(service.rpcUrl, asset.assetPath), {
      method: request.method ?? 'GET'
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      'content-length': body.byteLength,
      'content-type': upstream.headers.get('content-type') ?? contentType(asset.assetPath)
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    response.end(body);
  } catch (error) {
    console.warn(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: 'control_plane.provider_asset_proxy_failed',
        provider: asset.slug
      })
    );
    sendHttp(response, 502, 'text/plain; charset=utf-8', 'Bad Gateway');
  }
}

function providerAssetFromPath(
  path: string
): { assetPath: string; assetVersion: string; slug: string } | null {
  const relativePath = path.slice(CONTROL_PLANE_PROVIDER_ASSETS_PREFIX.length);
  const segments = relativePath.split('/');
  if (segments.length < 3) {
    return null;
  }
  const slug = decodeURIComponent(segments[0] ?? '');
  const assetVersion = decodeURIComponent(segments[1] ?? '');
  const assetPath = segments
    .slice(2)
    .map((segment) => decodeURIComponent(segment))
    .join('/');
  if (
    !safeProviderAssetSegment(slug) ||
    !safeProviderAssetVersion(assetVersion) ||
    !safeProviderAssetPath(assetPath)
  ) {
    return null;
  }
  return {
    assetPath,
    assetVersion,
    slug
  };
}

function providerAssetProxyUrl(slug: string, assetVersion: string, assetPath: string): string {
  return `${CONTROL_PLANE_PROVIDER_ASSETS_PREFIX}${encodeURIComponent(slug)}/${encodeURIComponent(
    assetVersion
  )}/${assetPath.split('/').map(encodeURIComponent).join('/')}`;
}

function providerFileFromPath(path: string): { providerPath: string; slug: string } | null {
  const relativePath = path.slice(CONTROL_PLANE_PROVIDER_FILES_PREFIX.length);
  const segments = relativePath.split('/');
  if (segments.length < 2) {
    return null;
  }
  const slug = decodeURIComponent(segments[0] ?? '');
  const providerPath = `/${segments
    .slice(1)
    .map((segment) => decodeURIComponent(segment))
    .join('/')}`;
  if (!safeProviderAssetSegment(slug) || !safeProviderFilePath(providerPath)) {
    return null;
  }
  return {
    providerPath,
    slug
  };
}

function providerRpcFileUrl(rpcUrl: string, providerPath: string): string {
  return `${rpcUrl.replace(/\/$/, '')}${providerPath
    .split('/')
    .map((segment, index) => (index === 0 ? '' : encodeURIComponent(segment)))
    .join('/')}`;
}

function providerRpcAssetUrl(rpcUrl: string, assetPath: string): string {
  return `${rpcUrl.replace(/\/$/, '')}/control-plane-assets/${assetPath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

function safeProviderAssetPath(assetPath: string): boolean {
  return (
    assetPath.length > 0 &&
    !assetPath.startsWith('/') &&
    !assetPath.includes('..') &&
    !assetPath.includes('\\')
  );
}

function safeProviderFilePath(providerPath: string): boolean {
  return (
    providerPath.startsWith('/') &&
    providerPath.length > 1 &&
    !providerPath.includes('..') &&
    !providerPath.includes('\\')
  );
}

function safeProviderAssetVersion(assetVersion: string): boolean {
  return safeProviderAssetSegment(assetVersion);
}

function safeProviderAssetSegment(segment: string): boolean {
  return (
    segment.length > 0 &&
    !segment.includes('/') &&
    !segment.includes('..') &&
    !segment.includes('\\')
  );
}

type ControlPlaneProviderRegistration = NonNullable<
  ReturnType<typeof parseControlPlaneProviderRegistration>
>;

function providerAssetVersionActive(
  registration: ControlPlaneProviderRegistration,
  asset: { assetPath: string; assetVersion: string }
): boolean {
  const activeAssetVersion = activeVersionForPath(registration, asset.assetPath);
  return activeAssetVersion !== null && activeVersionScope(registration, asset.assetVersion);
}

function activeVersionForPath(
  registration: ControlPlaneProviderRegistration,
  assetPath: string
): string | null {
  if (registration.assetVersions !== undefined) {
    return registration.assetVersions[assetPath] ?? null;
  }
  return registration.assetVersion;
}

function activeVersionScope(
  registration: ControlPlaneProviderRegistration,
  assetVersion: string
): boolean {
  return (
    registration.assetVersion === assetVersion ||
    Object.values(registration.assetVersions ?? {}).includes(assetVersion)
  );
}

function sendJsonHttp(response: ServerResponse, method: string | undefined, body: unknown): void {
  const payload = Buffer.from(JSON.stringify(body));
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-length': payload.byteLength,
    'content-type': 'application/json; charset=utf-8'
  });
  if (method === 'HEAD') {
    response.end();
    return;
  }
  response.end(payload);
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
    case '.gif':
      return 'image/gif';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.mp4':
      return 'video/mp4';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.zip':
      return 'application/zip';
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
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('error', onError);
      reject(error);
    };

    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      resolve();
    });
  });
}

async function cleanupControlPlaneStartupFailure(resources: {
  clients: Set<WebSocket>;
  procedureProxy: ControlPlaneProcedureProxy | undefined;
  server: Server | undefined;
  serverListening: boolean;
  serviceDirectory: ServiceDirectoryClient | undefined;
  subscriptions: EventSubscription[];
  webSocketServer: WebSocketServer | undefined;
}): Promise<void> {
  for (const subscription of resources.subscriptions) {
    try {
      subscription.unsubscribe();
    } catch (error) {
      logStartupCleanupFailure('control_plane.subscription_unsubscribe', error);
    }
  }

  try {
    resources.procedureProxy?.close();
  } catch (error) {
    logStartupCleanupFailure('control_plane.procedure_proxy_close', error);
  }

  try {
    resources.serviceDirectory?.close();
  } catch (error) {
    logStartupCleanupFailure('control_plane.service_directory_close', error);
  }

  closeWebSocketClients(resources.clients);

  const webSocketServer = resources.webSocketServer;
  if (webSocketServer !== undefined) {
    await runStartupCleanupStep('control_plane.websocket_server_close', () =>
      closeWebSocketServer(webSocketServer)
    );
  }

  const server = resources.server;
  if (server !== undefined && resources.serverListening) {
    await runStartupCleanupStep('control_plane.http_server_close', () => closeHttpServer(server));
  }
}

async function cleanupControlPlaneEventBusStartupFailure(eventBus: EventBus): Promise<void> {
  await runStartupCleanupStep('control_plane.event_bus_close', () => eventBus.close());
}

async function runStartupCleanupStep(name: string, step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch (error) {
    logStartupCleanupFailure(name, error);
  }
}

function logStartupCleanupFailure(step: string, error: unknown): void {
  console.warn(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'control_plane.startup_cleanup_failed',
      step
    })
  );
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
