import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { WebSocket } from 'ws';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app/createApp.js';
import { startControlPlaneServer } from '../src/edges/control-plane/server.js';
import { startGatewayServer } from '../src/edges/gateway/server.js';
import { rawDataToString } from '../src/edges/rpc.js';

describe('edge servers', () => {
  it('serves Gateway methods through direct app services', async () => {
    const app = createApp({
      cwd: mkdtempSync(join(tmpdir(), 'agentg-gateway-')),
      env: {
        AGENTG_SQLITE_PATH: './gateway.sqlite'
      }
    });

    await app.start();
    const server = await startGatewayServer({
      capabilities: ['telegram.read'],
      config: {
        enabled: true,
        host: '127.0.0.1',
        port: 0
      },
      eventBus: app.eventBus,
      plugins: app.plugins,
      services: app.services
    });
    const client = await openWebSocket(`ws://${server.host}:${String(server.port)}/ws`);

    try {
      client.send(
        JSON.stringify({
          id: 1,
          method: 'capabilities.list',
          params: {}
        })
      );

      await expect(readJsonMessage(client)).resolves.toMatchObject({
        id: 1,
        result: {
          capabilities: [{ name: 'telegram.read' }]
        }
      });
    } finally {
      client.close();
      await server.close();
      await app.stop();
    }
  });

  it('broadcasts runtime events to Control Plane clients', async () => {
    const app = createApp({
      cwd: mkdtempSync(join(tmpdir(), 'agentg-control-plane-')),
      env: {
        AGENTG_SQLITE_PATH: './control-plane.sqlite'
      }
    });

    await app.start();
    const server = await startControlPlaneServer({
      config: {
        enabled: true,
        host: '127.0.0.1',
        port: 0,
        staticDir: join(tmpdir(), 'agentg-empty-control-plane')
      },
      eventBus: app.eventBus,
      plugins: app.plugins,
      services: app.services
    });
    const client = await openWebSocket(`ws://${server.host}:${String(server.port)}/ws`);

    try {
      const messagePromise = readJsonMessageMatching(
        client,
        (message) =>
          isRecord(message) &&
          isRecord(message.event) &&
          message.event.type === 'history.message.recorded'
      );
      await app.services.telegram.ingestUpdate({
        _: 'updateNewMessage',
        message: {
          _: 'message',
          chat_id: 99,
          content: {
            _: 'messageText',
            text: {
              _: 'formattedText',
              text: 'edge event'
            }
          },
          date: 1_700_000_300,
          id: 100
        }
      });

      await expect(messagePromise).resolves.toMatchObject({
        event: {
          source: 'history',
          type: 'history.message.recorded'
        }
      });
    } finally {
      client.close();
      await server.close();
      await app.stop();
    }
  });
});

async function openWebSocket(url: string): Promise<WebSocket> {
  const client = new WebSocket(url);

  await new Promise<void>((resolve, reject) => {
    client.once('open', resolve);
    client.once('error', reject);
  });

  return client;
}

async function readJsonMessage(client: WebSocket): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    client.once('message', (payload) => {
      try {
        resolve(JSON.parse(rawDataToString(payload)) as unknown);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    client.once('error', reject);
  });
}

async function readJsonMessageMatching(
  client: WebSocket,
  predicate: (message: unknown) => boolean
): Promise<unknown> {
  for (;;) {
    const message = await readJsonMessage(client);
    if (predicate(message)) {
      return message;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
