import { describe, expect, it } from 'vitest';

import { readAuthConfig, readConfig, readDatabaseConfig } from '../src/config.js';

describe('Telegram config', () => {
  it('reads required module config and local defaults', () => {
    const config = readConfig({
      DATABASE_URL: 'postgres://agentg:agentg@127.0.0.1:5432/agentg',
      NATS_URL: 'nats://127.0.0.1:4222'
    });

    expect(config).toEqual({
      apiHash: undefined,
      apiId: undefined,
      databaseUrl: 'postgres://agentg:agentg@127.0.0.1:5432/agentg',
      host: undefined,
      ingestionUpdateConcurrency: 10,
      natsUrl: 'nats://127.0.0.1:4222',
      port: 8702,
      tdlibDatabaseDirectory: './td-data/database',
      tdlibFilesDirectory: './td-data/files'
    });
  });

  it('parses Telegram api id and process overrides', () => {
    const config = readConfig({
      DATABASE_URL: 'postgres://agentg:agentg@127.0.0.1:5432/agentg',
      HOST: '0.0.0.0',
      NATS_URL: 'nats://127.0.0.1:4222',
      PORT: '8080',
      TDLIB_DATABASE_DIR: '/td/database',
      TDLIB_FILES_DIR: '/td/files',
      TELEGRAM_INGESTION_UPDATE_CONCURRENCY: '2',
      TELEGRAM_API_HASH: 'hash',
      TELEGRAM_API_ID: '12345'
    });

    expect(config).toMatchObject({
      apiHash: 'hash',
      apiId: 12345,
      host: '0.0.0.0',
      ingestionUpdateConcurrency: 2,
      port: 8080,
      tdlibDatabaseDirectory: '/td/database',
      tdlibFilesDirectory: '/td/files'
    });
  });

  it('supports auth-only and database-only config readers', () => {
    expect(
      readAuthConfig({
        TELEGRAM_API_HASH: 'hash',
        TELEGRAM_API_ID: '12345'
      })
    ).toEqual({
      apiHash: 'hash',
      apiId: 12345,
      tdlibDatabaseDirectory: './td-data/database',
      tdlibFilesDirectory: './td-data/files'
    });

    expect(
      readDatabaseConfig({
        DATABASE_URL: 'postgres://agentg:agentg@127.0.0.1:5432/agentg'
      })
    ).toEqual({
      databaseUrl: 'postgres://agentg:agentg@127.0.0.1:5432/agentg'
    });
  });
});
