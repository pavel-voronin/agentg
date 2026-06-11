import { afterEach, describe, expect, it } from 'vitest';

import { DashboardClient } from '../src/dashboard/dashboardClient.js';

type ListenerMap = {
  close: (() => void)[];
  message: ((message: { data: unknown }) => void)[];
  open: (() => void)[];
};

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static initialReadyState = 1;

  readonly listeners: ListenerMap = {
    close: [],
    message: [],
    open: []
  };
  readonly sent: string[] = [];
  readyState = FakeWebSocket.initialReadyState;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener<T extends keyof ListenerMap>(type: T, listener: ListenerMap[T][number]): void {
    this.listeners[type].push(listener as never);
  }

  close(): void {
    for (const listener of this.listeners.close) {
      listener();
    }
  }

  open(): void {
    this.readyState = 1;
    for (const listener of this.listeners.open) {
      listener();
    }
  }

  send(data: string): void {
    this.sent.push(data);
  }
}

describe('Dashboard browser client', () => {
  const originalWebSocket = globalThis.WebSocket;

  afterEach(() => {
    FakeWebSocket.instances = [];
    FakeWebSocket.initialReadyState = 1;
    globalThis.WebSocket = originalWebSocket;
  });

  it('omits params for void RPC calls', async () => {
    globalThis.WebSocket = FakeWebSocket as never;
    const client = new DashboardClient({
      reconnectDelayMs: 1,
      url: () => 'ws://127.0.0.1:8789/ws'
    });

    client.connect();
    const pending = client.rpc('beta.getStatus').catch(() => undefined);

    expect(FakeWebSocket.instances[0]?.sent).toEqual([
      JSON.stringify({
        id: 1,
        method: 'beta.getStatus'
      })
    ]);
    client.disconnect();
    await pending;
  });

  it('sends explicit params unchanged', async () => {
    globalThis.WebSocket = FakeWebSocket as never;
    const client = new DashboardClient({
      reconnectDelayMs: 1,
      url: () => 'ws://127.0.0.1:8789/ws'
    });

    client.connect();
    const pending = client.rpc('alpha.listItems', { limit: 10 }).catch(() => undefined);

    expect(FakeWebSocket.instances[0]?.sent).toEqual([
      JSON.stringify({
        id: 1,
        method: 'alpha.listItems',
        params: {
          limit: 10
        }
      })
    ]);
    client.disconnect();
    await pending;
  });

  it('rejects non-serializable RPC params without sending a request', async () => {
    globalThis.WebSocket = FakeWebSocket as never;
    const client = new DashboardClient({
      reconnectDelayMs: 1,
      url: () => 'ws://127.0.0.1:8789/ws'
    });

    client.connect();
    await expect(client.rpc('alpha.listItems', { value: 1n })).rejects.toMatchObject({
      code: 'dashboard_rpc_failed',
      message:
        'Dashboard RPC request is not JSON-serializable: Do not know how to serialize a BigInt',
      name: 'DashboardRpcError'
    });
    expect(FakeWebSocket.instances[0]?.sent).toEqual([]);

    const pending = client.rpc('alpha.listItems', { limit: 10 }).catch(() => undefined);
    expect(FakeWebSocket.instances[0]?.sent).toEqual([
      JSON.stringify({
        id: 1,
        method: 'alpha.listItems',
        params: {
          limit: 10
        }
      })
    ]);
    client.disconnect();
    await pending;
  });

  it('waits for the socket to open before sending initial RPC calls', async () => {
    FakeWebSocket.initialReadyState = 0;
    globalThis.WebSocket = FakeWebSocket as never;
    const client = new DashboardClient({
      reconnectDelayMs: 1,
      url: () => 'ws://127.0.0.1:8789/ws'
    });

    client.connect();
    const pending = client.rpc('alpha.listItems', { limit: 10 }).catch(() => undefined);

    expect(FakeWebSocket.instances[0]?.sent).toEqual([]);
    FakeWebSocket.instances[0]?.open();
    await Promise.resolve();
    expect(FakeWebSocket.instances[0]?.sent).toEqual([
      JSON.stringify({
        id: 1,
        method: 'alpha.listItems',
        params: {
          limit: 10
        }
      })
    ]);
    client.disconnect();
    await pending;
  });

  it('preserves Dashboard RPC error codes', async () => {
    globalThis.WebSocket = FakeWebSocket as never;
    const client = new DashboardClient({
      reconnectDelayMs: 1,
      url: () => 'ws://127.0.0.1:8789/ws'
    });

    client.connect();
    const pending = client.rpc('alpha.listItems', { limit: 10 });
    const socket = FakeWebSocket.instances[0];
    for (const listener of socket?.listeners.message ?? []) {
      listener({
        data: JSON.stringify({
          error: {
            code: 'dependency_unavailable',
            message: 'Procedure transport failed: fetch failed'
          },
          id: 1
        })
      });
    }

    await expect(pending).rejects.toMatchObject({
      code: 'dependency_unavailable',
      message: 'Procedure transport failed: fetch failed',
      name: 'DashboardRpcError'
    });
    client.disconnect();
  });
});
