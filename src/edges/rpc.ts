import type { Server } from 'node:http';

import type { RawData, WebSocket, WebSocketServer } from 'ws';

export type EdgeRpcRequest = {
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

export type EdgeRpcResponse = {
  id: string | number | null;
  error?: {
    code: string;
    message: string;
  };
  result?: unknown;
};

export function parseRpcRequest(payload: string): EdgeRpcRequest | undefined {
  try {
    const parsed: unknown = JSON.parse(payload);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeRequestId(value: unknown): string | number | null {
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

export function sendRpcResponse(client: WebSocket, response: EdgeRpcResponse): void {
  if (client.readyState === client.OPEN) {
    client.send(JSON.stringify(response));
  }
}

export function rawDataToString(payload: RawData): string {
  if (Array.isArray(payload)) {
    return Buffer.concat(payload).toString('utf8');
  }
  if (payload instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(payload)).toString('utf8');
  }

  return payload.toString('utf8');
}

export async function listen(server: Server, host: string, port: number): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (typeof address === 'object' && address !== null) {
    return address.port;
  }

  throw new Error('HTTP server did not expose a TCP port');
}

export async function closeHttpServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }
      reject(error);
    });
  });
}

export async function closeWebSocketServer(server: WebSocketServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }
      reject(error);
    });
  });
}

export function closeWebSocketClients(clients: Set<WebSocket>): void {
  for (const client of clients) {
    client.close();
  }
  clients.clear();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
