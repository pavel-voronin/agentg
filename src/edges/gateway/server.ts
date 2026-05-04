import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

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

export type GatewayServerConfig = {
  enabled: boolean;
  host: string;
  port: number;
  token?: string;
};

export type GatewayServerOptions = {
  capabilities: string[];
  config: GatewayServerConfig;
  eventBus: EventBus;
  plugins: AppPluginRegistry;
  services: AppServiceRegistry;
};

export type GatewayServerHandle = {
  close(): Promise<void>;
  host: string;
  port: number;
};

type GatewayRuntime = Pick<GatewayServerOptions, 'capabilities' | 'plugins' | 'services'>;

export async function startGatewayServer(
  options: GatewayServerOptions
): Promise<GatewayServerHandle> {
  const runtime: GatewayRuntime = {
    capabilities: options.capabilities,
    plugins: options.plugins,
    services: options.services
  };
  const server = createServer(handleHttpRequest);
  const webSocketServer = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();

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
      void handleClientMessage(runtime, client, rawDataToString(payload));
    });
    client.on('close', () => {
      clients.delete(client);
    });
  });

  const subscription = options.eventBus.subscribeAll((event) => {
    if (isGatewayEvent(event)) {
      broadcast(clients, { event });
    }
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

export async function callGatewayMethod(
  runtime: GatewayRuntime,
  method: string,
  params: unknown
): Promise<unknown> {
  if (method === 'capabilities.list') {
    return {
      capabilities: runtime.capabilities.map((name) => ({ name }))
    };
  }

  if (method === 'telegram.getChat') {
    return runtime.services.telegram.getChat(readStringParam(params, 'chatId'));
  }

  if (method === 'telegram.getMessage') {
    return runtime.services.telegram.getMessage(
      readStringParam(params, 'chatId'),
      readStringParam(params, 'messageId')
    );
  }

  if (method === 'history.listMessages') {
    return runtime.services.history.listMessages(readStringParam(params, 'chatId'));
  }

  if (method === 'summaries.readChatSummary') {
    return runtime.plugins.summaries.readChatSummary(readStringParam(params, 'chatId'));
  }

  if (method === 'summaries.requestChatSummary') {
    const reason = readOptionalString(params, 'reason');
    return runtime.plugins.summaries.requestChatSummary({
      chatId: readStringParam(params, 'chatId'),
      ...(reason === undefined ? {} : { reason })
    });
  }

  throw new Error(`Unknown Gateway method: ${method}`);
}

async function handleClientMessage(
  runtime: GatewayRuntime,
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
      result: await callGatewayMethod(runtime, request.method, request.params)
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

function handleHttpRequest(_request: IncomingMessage, response: ServerResponse): void {
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('ok');
}

function broadcast(clients: Set<WebSocket>, message: unknown): void {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function isAuthorized(request: IncomingMessage, token: string | undefined): boolean {
  if (token === undefined) {
    return true;
  }

  const url = new URL(request.url ?? '/', 'http://localhost');
  return url.searchParams.get('token') === token;
}

function isGatewayEvent(event: AppEvent): boolean {
  return (
    event.type.startsWith('telegram.') ||
    event.type.startsWith('history.') ||
    event.type.startsWith('summaries.')
  );
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

function readOptionalString(params: unknown, key: string): string | undefined {
  return isRecord(params) && typeof params[key] === 'string' ? params[key] : undefined;
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
