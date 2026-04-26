import { describe, expect, it } from 'vitest';

import { loadDatabaseCliConfig } from '@agentg/database/config';
import { loadTelegramIngestionConfig } from '@agentg/telegram/config';

describe('loadConfig', () => {
  it('uses local development defaults', () => {
    const config = loadDatabaseCliConfig({});

    expect(config).toMatchObject({
      appMode: 'smoke',
      databaseUrl: 'postgres://agentg:agentg@localhost:5432/agentg'
    });
  });

  it('rejects invalid app mode', () => {
    expect(() => loadDatabaseCliConfig({ APP_MODE: 'bot' })).toThrow(
      'APP_MODE must be "migrate" or "smoke"'
    );
  });
});

describe('loadTelegramIngestionConfig', () => {
  it('uses local ingestion defaults', () => {
    const config = loadTelegramIngestionConfig({});

    expect(config).toMatchObject({
      backfill: {
        chatLoadBatchSize: 100,
        messageLimit: 100,
        requestDelayMs: 1000,
        windowDays: 31
      },
      databaseUrl: 'postgres://agentg:agentg@localhost:5432/agentg',
      nats: {
        url: 'nats://localhost:4222'
      },
      telegram: {
        databaseDirectory: './td-data/database',
        filesDirectory: './td-data/files'
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
});
