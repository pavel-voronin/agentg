import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { InternalTrpcClientConfig as TelegramInternalTrpcClientConfig } from '@agentg/telegram/rpc';
import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import type { IntegrationEvent } from '@agentg/shared/events/envelope';
import {
  capabilityRegistrationInputSchema,
  createCapabilityRegistry,
  type CapabilityRegistry
} from '@agentg/shared/rpc/capabilities';
import { WebSocket, WebSocketServer, type RawData } from 'ws';

import {
  callGatewayCapability,
  createTrpcGatewayCapabilityCaller,
  DEFAULT_GATEWAY_CAPABILITY_CALL_TIMEOUT_MS,
  listGatewayCapabilities,
  type GatewayCapabilityCaller
} from './capabilities.js';
import {
  createTrpcGatewayHistoryClient,
  type GatewayHistoryClient
} from './history-observability.js';
import {
  composeGatewayExtensions,
  createTrpcGatewayExtensionGetterCaller,
  createTrpcGatewayExtensionRegistryClient,
  gatewayExtensionComposeInputSchema,
  type ExtensionServiceConfig,
  type GatewayExtensionComposer
} from './extensions.js';
import { createTrpcGatewayTelegramClient, type GatewayTelegramClient } from './telegram-reads.js';

type InternalServiceConfig = {
  url: string;
};

export type AgentGatewayConfig = {
  host: string;
  port: number;
  token?: string;
};

export type AgentGatewayOptions = {
  capabilityCallTimeoutMs?: number;
  capabilityCaller?: GatewayCapabilityCaller;
  capabilityRegistry?: CapabilityRegistry;
  capabilityRegistrationTtlMs?: number;
  config: AgentGatewayConfig;
  eventBus: EventBus;
  services: {
    extensionRegistry?: InternalServiceConfig;
    extensions?: {
      summaries?: InternalServiceConfig | undefined;
    };
    history: InternalServiceConfig;
    telegram: TelegramInternalTrpcClientConfig;
  };
};

type AgentGatewayRuntime = AgentGatewayOptions & {
  capabilityCallTimeoutMs: number;
  capabilityCaller: GatewayCapabilityCaller;
  capabilityRegistry: CapabilityRegistry;
  extensionComposer?: GatewayExtensionComposer;
  historyClient: GatewayHistoryClient;
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
  const historyClient = createTrpcGatewayHistoryClient(options.services.history);
  const telegramClient = createTrpcGatewayTelegramClient(options.services.telegram);
  const extensionComposer =
    options.services.extensionRegistry === undefined
      ? undefined
      : {
          callExtension: createTrpcGatewayExtensionGetterCaller(
            extensionServicesFromConfig(options.services.extensions)
          ),
          registry: createTrpcGatewayExtensionRegistryClient(options.services.extensionRegistry)
        };
  const capabilityRegistry =
    options.capabilityRegistry ??
    createCapabilityRegistry(
      options.capabilityRegistrationTtlMs === undefined
        ? {}
        : { ttlMs: options.capabilityRegistrationTtlMs }
    );
  const runtime: AgentGatewayRuntime = {
    ...options,
    capabilityCallTimeoutMs:
      options.capabilityCallTimeoutMs ?? DEFAULT_GATEWAY_CAPABILITY_CALL_TIMEOUT_MS,
    capabilityCaller: options.capabilityCaller ?? createTrpcGatewayCapabilityCaller(),
    capabilityRegistry,
    ...(extensionComposer === undefined ? {} : { extensionComposer }),
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

  const port = await listen(server, options.config.host, options.config.port);
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
        server,
        webSocketServer,
        clients,
        subscriptions,
        options.eventBus,
        historyClient,
        telegramClient
      );
    },
    host: options.config.host,
    port
  };
}

export async function runAgentGateway(options: AgentGatewayOptions): Promise<void> {
  const handle = await startAgentGatewayServer(options);
  await waitForShutdown(handle);
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
  if (method === 'extensions.compose') {
    return composeGatewayMethod(options, params);
  }

  return callDomainOrGatewayMethod(options, method, params);
}

async function callDomainOrGatewayMethod(
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

  if (method === 'capabilities.register') {
    return options.capabilityRegistry.register(capabilityRegistrationInputSchema.parse(params));
  }

  if (method === 'capabilities.list') {
    return listGatewayCapabilities(options.capabilityRegistry);
  }

  if (method === 'capabilities.call') {
    return callGatewayCapability(options, params);
  }

  throw new Error(`Unknown method: ${method}`);
}

async function composeGatewayMethod(
  options: AgentGatewayRuntime,
  params: unknown
): Promise<unknown> {
  if (options.extensionComposer === undefined) {
    throw new Error('Extension composition is not configured');
  }

  const input = gatewayExtensionComposeInputSchema.parse(params);
  const base = await callDomainOrGatewayMethod(options, input.method, input.params);
  return composeGatewayExtensions(options.extensionComposer, base);
}

function extensionServicesFromConfig(
  services: AgentGatewayOptions['services']['extensions']
): ExtensionServiceConfig[] {
  return [
    ...(services?.summaries === undefined
      ? []
      : [
          {
            slug: 'summaries',
            url: services.summaries.url
          }
        ])
  ];
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

async function listen(server: Server, host: string, port: number): Promise<number> {
  return new Promise<number>((resolve) => {
    server.listen(port, host, () => {
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        resolve(address.port);
        return;
      }

      resolve(port);
    });
  });
}

async function closeAgentGateway(
  server: Server,
  webSocketServer: WebSocketServer,
  clients: Set<WebSocket>,
  subscriptions: EventSubscription[],
  eventBus: EventBus,
  historyClient: GatewayHistoryClient,
  telegramClient: GatewayTelegramClient
): Promise<void> {
  for (const subscription of subscriptions) {
    subscription.unsubscribe();
  }
  for (const client of clients) {
    client.close();
  }
  historyClient.close();
  telegramClient.close();
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
