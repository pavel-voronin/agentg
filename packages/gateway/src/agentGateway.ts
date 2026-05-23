import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { createServiceDirectoryClient } from '@agentg/service-directory/rpc';
import type { EventBus, EventSubscription } from '@agentg/events/bus';
import type { IntegrationEvent } from '@agentg/events/envelope';
import { WebSocket, WebSocketServer, type RawData } from 'ws';

import {
  createServiceDirectoryGatewayTelegramClient,
  type GatewayTelegramClient
} from './telegramReads.js';
import { createGatewayServiceManifest } from './registrations.js';

type InternalServiceConfig = {
  url: string;
};

const EXTERNAL_EVENT_SUBJECT = 'telegram.login.completed';

export type AgentGatewayConfig = {
  host: string;
  port: number;
  serviceUrl: string;
  token?: string;
};

export type AgentGatewayOptions = {
  config: AgentGatewayConfig;
  eventBus: EventBus;
  services?: {
    serviceDirectory: InternalServiceConfig;
  };
  telegramClient?: GatewayTelegramClient;
};

type AgentGatewayRuntime = AgentGatewayOptions & {
  telegramClient: GatewayTelegramClient;
};

export type AgentGatewayServerHandle = {
  close(): Promise<void>;
  host: string;
  port: number;
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

export async function startAgentGatewayServer(
  options: AgentGatewayOptions
): Promise<AgentGatewayServerHandle> {
  let serviceDirectory: ReturnType<typeof createServiceDirectoryClient> | undefined;
  let telegramClient: GatewayTelegramClient | undefined;
  let server: Server | undefined;
  let webSocketServer: WebSocketServer | undefined;
  const clients = new Set<WebSocket>();
  let subscriptions: EventSubscription[] = [];
  const ownsTelegramClient = options.telegramClient === undefined;

  try {
    serviceDirectory =
      options.telegramClient === undefined
        ? createServiceDirectoryClient({
            eventBus: options.eventBus,
            onTopologyFailure: (error) => {
              requestProcessShutdown('agent_gateway.topology_failure', error);
            },
            url: requireServiceDirectoryConfig(options).url
          })
        : undefined;
    await serviceDirectory?.refresh();
    telegramClient =
      options.telegramClient ??
      createServiceDirectoryGatewayTelegramClient(requireServiceDirectory(serviceDirectory));
    const runtime: AgentGatewayRuntime = {
      ...options,
      telegramClient
    };
    server = createServer((request, response) => {
      handleHttpRequest(request, response);
    });
    const createdWebSocketServer = new WebSocketServer({ noServer: true });
    webSocketServer = createdWebSocketServer;

    server.on('upgrade', (request, socket, head) => {
      if (!isAuthorized(request.url, options.config.token)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
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
      options.eventBus.subscribe(EXTERNAL_EVENT_SUBJECT, (event) => {
        broadcast(clients, {
          event
        });
      })
    ];

    const port = await listen(server, options.config.host, options.config.port);
    await serviceDirectory?.join(
      createGatewayServiceManifest({ serviceUrl: options.config.serviceUrl })
    );
    const activeTelegramClient = requireStartedResource(
      telegramClient,
      'Agent Gateway telegram client'
    );
    const activeServer = requireStartedResource(server, 'Agent Gateway HTTP server');
    const activeWebSocketServer = requireStartedResource(
      webSocketServer,
      'Agent Gateway WebSocket server'
    );
    console.log(
      JSON.stringify({
        event: 'agent_gateway.ready',
        host: options.config.host,
        port
      })
    );

    return {
      async close(): Promise<void> {
        await closeAgentGateway(
          activeServer,
          activeWebSocketServer,
          clients,
          subscriptions,
          options.eventBus,
          activeTelegramClient,
          serviceDirectory
        );
      },
      host: options.config.host,
      port
    };
  } catch (error) {
    await cleanupAgentGatewayStartupFailure({
      clients,
      ownsTelegramClient,
      server,
      serviceDirectory,
      subscriptions,
      telegramClient,
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

export async function runAgentGateway(options: AgentGatewayOptions): Promise<void> {
  let handle: AgentGatewayServerHandle | undefined;
  try {
    handle = await startAgentGatewayServer(options);
    await waitForShutdown(handle);
  } catch (error) {
    if (handle === undefined) {
      await cleanupAgentGatewayEventBusStartupFailure(options.eventBus);
    }
    throw error;
  }
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
    const responseError = rpcErrorFromUnknown(error);
    sendResponse(client, {
      id,
      error: responseError
    });
  }
}

async function callMethod(
  options: AgentGatewayRuntime,
  method: string,
  params: unknown
): Promise<unknown> {
  if (method === 'telegram.getChat') {
    return options.telegramClient.call(method, params);
  }

  throw new UnknownGatewayMethodError(method);
}

function rpcErrorFromUnknown(error: unknown): { code: string; message: string } {
  const record = typeof error === 'object' && error !== null ? (error as { code?: unknown }) : {};
  if (record.code === 'dependency_unavailable') {
    return {
      code: 'dependency_unavailable',
      message: error instanceof Error ? error.message : String(error)
    };
  }
  if (error instanceof UnknownGatewayMethodError) {
    return {
      code: 'unknown_method',
      message: error.message
    };
  }

  return {
    code: 'method_failed',
    message: error instanceof Error ? error.message : String(error)
  };
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

function requireServiceDirectoryConfig(options: AgentGatewayOptions): InternalServiceConfig {
  const config = options.services?.serviceDirectory;
  if (config === undefined) {
    throw new Error('Agent Gateway requires Service Directory config');
  }

  return config;
}

function requireServiceDirectory(
  serviceDirectory: ReturnType<typeof createServiceDirectoryClient> | undefined
): ReturnType<typeof createServiceDirectoryClient> {
  if (serviceDirectory === undefined) {
    throw new Error('Agent Gateway requires Service Directory client');
  }

  return serviceDirectory;
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

async function cleanupAgentGatewayStartupFailure(resources: {
  clients: Set<WebSocket>;
  ownsTelegramClient: boolean;
  server: Server | undefined;
  serviceDirectory: ReturnType<typeof createServiceDirectoryClient> | undefined;
  subscriptions: EventSubscription[];
  telegramClient: GatewayTelegramClient | undefined;
  webSocketServer: WebSocketServer | undefined;
}): Promise<void> {
  for (const subscription of resources.subscriptions) {
    try {
      subscription.unsubscribe();
    } catch (error) {
      logStartupCleanupFailure('agent_gateway.subscription_unsubscribe', error);
    }
  }

  for (const client of resources.clients) {
    client.close();
  }
  resources.clients.clear();

  if (resources.ownsTelegramClient) {
    try {
      resources.telegramClient?.close();
    } catch (error) {
      logStartupCleanupFailure('agent_gateway.telegram_client_close', error);
    }
  }

  try {
    resources.serviceDirectory?.close();
  } catch (error) {
    logStartupCleanupFailure('agent_gateway.service_directory_close', error);
  }

  const webSocketServer = resources.webSocketServer;
  if (webSocketServer !== undefined) {
    await runStartupCleanupStep('agent_gateway.websocket_server_close', () =>
      closeWebSocketServer(webSocketServer)
    );
  }

  const server = resources.server;
  if (server !== undefined) {
    await runStartupCleanupStep('agent_gateway.http_server_close', () => closeHttpServer(server));
  }
}

async function cleanupAgentGatewayEventBusStartupFailure(eventBus: EventBus): Promise<void> {
  await runStartupCleanupStep('agent_gateway.event_bus_close', () => eventBus.close());
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
      event: 'agent_gateway.startup_cleanup_failed',
      step
    })
  );
}

async function closeAgentGateway(
  server: Server,
  webSocketServer: WebSocketServer,
  clients: Set<WebSocket>,
  subscriptions: EventSubscription[],
  eventBus: EventBus,
  telegramClient: GatewayTelegramClient,
  serviceDirectory: ReturnType<typeof createServiceDirectoryClient> | undefined
): Promise<void> {
  for (const subscription of subscriptions) {
    subscription.unsubscribe();
  }
  for (const client of clients) {
    client.close();
  }
  telegramClient.close();
  serviceDirectory?.close();
  await Promise.all([closeWebSocketServer(webSocketServer), closeHttpServer(server)]);
  await eventBus.close();
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

async function waitForShutdown(handle: AgentGatewayServerHandle): Promise<void> {
  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      void handle.close().finally(resolve);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
