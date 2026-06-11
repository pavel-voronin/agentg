export type DashboardEvent = {
  data?: unknown;
  occurredAt?: string;
  id?: string;
  meta?: unknown;
  type?: string;
};

export type DashboardClientOptions = {
  onClose?: () => void;
  onEvent?: (event: DashboardEvent) => void;
  onOpen?: () => void;
  reconnectDelayMs?: number;
  rpcTimeoutMs?: number;
  url?: () => string;
};

type BrowserGlobal = {
  location?: {
    host: string;
    protocol: string;
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

type DashboardRpcErrorData = {
  code: string;
  message: string;
};

const DEFAULT_DASHBOARD_WS_URL = 'ws://127.0.0.1:8789/ws';
const DEFAULT_RECONNECT_DELAY_MS = 1000;
const DEFAULT_RPC_TIMEOUT_MS = 15000;
const WEBSOCKET_OPEN = 1;

class DashboardRpcError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'DashboardRpcError';
  }
}

export class DashboardClient {
  private connection: Promise<void> | null = null;
  private reconnectEnabled = false;
  private readonly pending = new Map<number, PendingRpc>();
  private nextId = 1;
  private socket: BrowserWebSocket | null = null;

  constructor(private readonly options: DashboardClientOptions = {}) {}

  connect(): void {
    this.reconnectEnabled = true;
    const socket = new (browserGlobal().WebSocket)(this.dashboardWebSocketUrl());
    this.socket = socket;
    this.connection = new Promise((resolve, reject) => {
      socket.addEventListener('open', () => {
        resolve();
      });
      socket.addEventListener('close', () => {
        reject(new Error('Dashboard WebSocket closed'));
      });
    });
    void this.connection.catch(() => undefined);

    socket.addEventListener('open', () => {
      this.options.onOpen?.();
    });
    socket.addEventListener('close', () => {
      if (this.socket === socket) {
        this.socket = null;
        this.connection = null;
      }
      this.options.onClose?.();
      this.rejectPending(new Error('Dashboard WebSocket closed'));
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

  rpc<T = unknown>(method: string, params?: unknown): Promise<T> {
    const openSocket = this.openSocket();
    if (openSocket instanceof Promise) {
      return openSocket.then(() => this.sendRpc(method, params));
    }

    return this.sendRpc(method, params);
  }

  private openSocket(): BrowserWebSocket | Promise<void> {
    const socket = this.socket;
    if (socket?.readyState === WEBSOCKET_OPEN) {
      return socket;
    }

    return this.connection ?? Promise.reject(new Error('Dashboard WebSocket is not connected'));
  }

  private sendRpc<T = unknown>(method: string, params?: unknown): Promise<T> {
    const socket = this.socket;
    if (socket?.readyState !== WEBSOCKET_OPEN) {
      return Promise.reject(new Error('Dashboard WebSocket is not connected'));
    }
    const id = this.nextId;
    let payload: string;
    try {
      payload = dashboardRpcRequestPayload(id, method, params);
      socket.send(payload);
    } catch (error) {
      return Promise.reject(dashboardRequestError(error));
    }
    this.nextId += 1;

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

  private dashboardWebSocketUrl(): string {
    const configuredOptionUrl = this.options.url?.();
    if (configuredOptionUrl) {
      return configuredOptionUrl;
    }
    const configuredUrl = configuredDashboardUrl();
    const url = new URL(configuredUrl ?? defaultDashboardUrl());
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

    if (isDashboardEvent(payload.event)) {
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

    const error = dashboardError(payload.error);
    if (error !== null) {
      pending.reject(new DashboardRpcError(error.code, error.message));
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

export function createDashboardClient(options: DashboardClientOptions = {}): DashboardClient {
  return new DashboardClient(options);
}

function browserGlobal(): BrowserGlobal {
  return globalThis;
}

function configuredDashboardUrl(): string | null {
  const env = import.meta.env as Record<string, unknown>;
  const value = env.VITE_DASHBOARD_WS_URL;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function defaultDashboardUrl(): string {
  const location = browserGlobal().location;
  if (location?.host) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/ws`;
  }

  return DEFAULT_DASHBOARD_WS_URL;
}

function dashboardError(error: unknown): DashboardRpcErrorData | null {
  if (error === undefined || error === null) {
    return null;
  }
  if (isPlainRecord(error)) {
    const code = typeof error.code === 'string' ? error.code : 'dashboard_rpc_failed';
    const message = error.message;
    return {
      code,
      message: typeof message === 'string' ? message : JSON.stringify(error)
    };
  }
  if (Array.isArray(error)) {
    return {
      code: 'dashboard_rpc_failed',
      message: JSON.stringify(error)
    };
  }
  if (
    typeof error === 'string' ||
    typeof error === 'number' ||
    typeof error === 'boolean' ||
    typeof error === 'bigint'
  ) {
    return {
      code: 'dashboard_rpc_failed',
      message: String(error)
    };
  }
  if (typeof error === 'symbol') {
    return {
      code: 'dashboard_rpc_failed',
      message: error.description ?? 'Dashboard RPC failed'
    };
  }
  return {
    code: 'dashboard_rpc_failed',
    message: 'Dashboard RPC failed'
  };
}

function dashboardRpcRequestPayload(id: number, method: string, params: unknown): string {
  try {
    return JSON.stringify(params === undefined ? { id, method } : { id, method, params });
  } catch (error) {
    throw new DashboardRpcError(
      'dashboard_rpc_failed',
      `Dashboard RPC request is not JSON-serializable: ${errorMessage(error)}`
    );
  }
}

function dashboardRequestError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new DashboardRpcError('dashboard_rpc_failed', errorMessage(error));
}

function isDashboardEvent(value: unknown): value is DashboardEvent {
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
