import { afterEach, describe, expect, it } from 'vitest';

import { ControlPlaneClient } from '../src/control-plane/controlPlaneClient.js';

type ListenerMap = {
  close: (() => void)[];
  message: ((message: { data: unknown }) => void)[];
  open: (() => void)[];
};

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readonly listeners: ListenerMap = {
    close: [],
    message: [],
    open: []
  };
  readonly sent: string[] = [];
  readyState = 1;

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

  send(data: string): void {
    this.sent.push(data);
  }
}

describe('Control Plane browser client', () => {
  const originalWebSocket = globalThis.WebSocket;

  afterEach(() => {
    FakeWebSocket.instances = [];
    globalThis.WebSocket = originalWebSocket;
  });

  it('omits params for void RPC calls', async () => {
    globalThis.WebSocket = FakeWebSocket as never;
    const client = new ControlPlaneClient({
      reconnectDelayMs: 1,
      url: () => 'ws://127.0.0.1:8789/ws'
    });

    client.connect();
    const pending = client.rpc('beta.getOverview').catch(() => undefined);

    expect(FakeWebSocket.instances[0]?.sent).toEqual([
      JSON.stringify({
        id: 1,
        method: 'beta.getOverview'
      })
    ]);
    client.disconnect();
    await pending;
  });

  it('sends explicit params unchanged', async () => {
    globalThis.WebSocket = FakeWebSocket as never;
    const client = new ControlPlaneClient({
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
});
