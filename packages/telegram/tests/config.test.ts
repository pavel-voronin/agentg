import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadTelegramIngestionConfig } from '../src/app/config.js';

const repositoryRoot = resolve(process.cwd(), '../..');

describe('loadTelegramIngestionConfig', () => {
  it('uses local ingestion defaults', () => {
    const config = loadTelegramIngestionConfig({});

    expect(config).toMatchObject({
      databaseUrl: 'postgres://agentg:agentg@localhost:5432/agentg',
      nats: {
        url: 'nats://localhost:4222'
      },
      internalRpc: {
        host: '127.0.0.1',
        port: 18081
      },
      serviceRpcUrl: 'http://127.0.0.1:18081',
      services: {
        serviceDirectory: {
          url: 'http://127.0.0.1:18084'
        }
      },
      telegram: {
        databaseDirectory: resolve(repositoryRoot, 'td-data/database'),
        filesDirectory: resolve(repositoryRoot, 'td-data/files')
      }
    });
  });

  it('parses Telegram api id', () => {
    const config = loadTelegramIngestionConfig({
      TELEGRAM_API_ID: '12345',
      TELEGRAM_API_HASH: 'hash'
    });

    expect(config.telegram.apiId).toBe(12345);
    expect(config.telegram.apiHash).toBe('hash');
  });

  it('parses internal RPC bind config', () => {
    const config = loadTelegramIngestionConfig({
      SERVICE_DIRECTORY_RPC_URL: 'http://service-directory:8080',
      TELEGRAM_RPC_HOST: '0.0.0.0',
      TELEGRAM_RPC_PORT: '8080',
      TELEGRAM_RPC_URL: 'http://telegram:8080'
    });

    expect(config.internalRpc).toEqual({
      host: '0.0.0.0',
      port: 8080
    });
    expect(config.serviceRpcUrl).toBe('http://telegram:8080');
    expect(config.services.serviceDirectory.url).toBe('http://service-directory:8080');
  });
});
