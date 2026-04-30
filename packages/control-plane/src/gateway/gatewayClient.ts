export type GatewayEvent = {
  data?: unknown;
  occurredAt?: Date | string;
  type?: string;
  [key: string]: unknown;
};

export type GatewayClientOptions = {
  onClose?: () => void;
  onEvent?: (event: GatewayEvent) => void;
  onOpen?: () => void;
  reconnectDelayMs?: number;
  rpcTimeoutMs?: number;
  url?: () => string;
};

type BrowserGlobal = {
  location?: {
    search: string;
  };
  WebSocket: new (url: string) => BrowserWebSocket;
};

type BrowserWebSocket = {
  addEventListener: {
    (type: 'close' | 'open', listener: () => void): void;
    (type: 'message', listener: (message: { data: unknown }) => void): void;
  };
  close: () => void;
  readyState: number;
  send: (data: string) => void;
};

type PendingRpc = {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const DEFAULT_GATEWAY_WS_URL = 'ws://127.0.0.1:8787/';
const DEFAULT_RECONNECT_DELAY_MS = 1000;
const DEFAULT_RPC_TIMEOUT_MS = 15000;
const WEBSOCKET_OPEN = 1;

export class GatewayClient {
  private reconnectEnabled = false;
  private readonly pending = new Map<number, PendingRpc>();
  private nextId = 1;
  private socket: BrowserWebSocket | null = null;

  constructor(private readonly options: GatewayClientOptions = {}) {}

  connect(): void {
    this.reconnectEnabled = true;
    const socket = new (browserGlobal().WebSocket)(this.gatewayWebSocketUrl());
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.options.onOpen?.();
    });
    socket.addEventListener('close', () => {
      if (this.socket === socket) {
        this.socket = null;
      }
      this.options.onClose?.();
      this.rejectPending(new Error('Gateway WebSocket closed'));
      if (this.reconnectEnabled) {
        setTimeout(() => {
          if (this.reconnectEnabled) {
            this.connect();
          }
        }, this.options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS);
      }
    });
    socket.addEventListener('message', (message) => {
      this.receiveMessage(message.data);
    });
  }

  disconnect(): void {
    this.reconnectEnabled = false;
    this.socket?.close();
    this.socket = null;
  }

  rpc<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const socket = this.socket;
    if (socket?.readyState !== WEBSOCKET_OPEN) {
      return Promise.reject(new Error('Gateway WebSocket is not connected'));
    }
    const id = this.nextId;
    this.nextId += 1;
    socket.send(JSON.stringify({ id, method, params }));

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, this.options.rpcTimeoutMs ?? DEFAULT_RPC_TIMEOUT_MS);

      this.pending.set(id, {
        reject,
        resolve: (value) => resolve(value as T),
        timeoutId
      });
    });
  }

  private gatewayWebSocketUrl(): string {
    const configuredOptionUrl = this.options.url?.();
    if (configuredOptionUrl) {
      return configuredOptionUrl;
    }
    const configuredUrl = configuredGatewayUrl();
    const url = new URL(configuredUrl ?? DEFAULT_GATEWAY_WS_URL);
    if (url.search.length === 0) {
      url.search = browserGlobal().location?.search ?? '';
    }
    return url.toString();
  }

  private receiveMessage(data: unknown): void {
    const payload = parseMessagePayload(data);
    if (!payload) {
      return;
    }

    const responseId = typeof payload.id === 'number' ? payload.id : null;
    if (responseId !== null && this.pending.has(responseId)) {
      this.receiveRpcResponse(responseId, payload);
      return;
    }

    if (isGatewayEvent(payload.event)) {
      this.options.onEvent?.(payload.event);
    }
  }

  private receiveRpcResponse(id: number, payload: Record<string, unknown>): void {
    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeoutId);
    this.pending.delete(id);

    const errorMessage = gatewayErrorMessage(payload.error);
    if (errorMessage !== null) {
      pending.reject(new Error(errorMessage));
      return;
    }
    pending.resolve(payload.result);
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

export function createGatewayClient(options: GatewayClientOptions = {}): GatewayClient {
  return new GatewayClient(options);
}

function browserGlobal(): BrowserGlobal {
  return globalThis;
}

function configuredGatewayUrl(): string | null {
  const env = import.meta.env as Record<string, unknown>;
  const value = env.VITE_AGENT_GATEWAY_WS_URL;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function gatewayErrorMessage(error: unknown): string | null {
  if (error === undefined || error === null) {
    return null;
  }
  if (isPlainRecord(error)) {
    const message = error.message;
    return typeof message === 'string' ? message : JSON.stringify(error);
  }
  if (Array.isArray(error)) {
    return JSON.stringify(error);
  }
  if (
    typeof error === 'string' ||
    typeof error === 'number' ||
    typeof error === 'boolean' ||
    typeof error === 'bigint'
  ) {
    return String(error);
  }
  if (typeof error === 'symbol') {
    return error.description ?? 'Gateway RPC failed';
  }
  return 'Gateway RPC failed';
}

function isGatewayEvent(value: unknown): value is GatewayEvent {
  return isPlainRecord(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMessagePayload(data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'string') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(data);
    return isPlainRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
