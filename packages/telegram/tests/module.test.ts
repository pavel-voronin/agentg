import { describe, expect, it } from 'vitest';
import { httpRpc, selfRegistry, type EventBusFactory } from '@agentg/framework';

import { telegramModule } from '../src/module.js';

describe('telegramModule', () => {
  it('exposes initial status procedure', async () => {
    const telegram = telegramModule({
      config: {
        apiHash: undefined,
        apiId: undefined,
        databaseUrl: 'postgres://agentg:agentg@127.0.0.1:1/agentg',
        host: undefined,
        natsUrl: 'nats://test',
        port: 0,
        registryUrl: 'http://127.0.0.1:1',
        tdlibDatabaseDirectory: './td-data/database',
        tdlibFilesDirectory: './td-data/files'
      },
      connect: {
        events: testEventBus(),
        rpc: httpRpc({ port: 0 }),
        registry: selfRegistry()
      }
    });

    expect(telegram.procedures.status()).toEqual({
      ready: false
    });

    await telegram.stop();
  });
});

function testEventBus(): EventBusFactory {
  return () => ({
    start() {
      return Promise.resolve();
    },
    stop() {
      return Promise.resolve();
    },
    publish() {
      return;
    },
    subscribe() {
      return {
        unsubscribe() {
          return;
        }
      };
    }
  });
}
