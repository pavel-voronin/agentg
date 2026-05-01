import { describe, expect, it } from 'vitest';

import { loadHistorySyncServiceConfig } from './config.js';

describe('loadHistorySyncServiceConfig', () => {
  it('uses local RPC defaults', () => {
    const config = loadHistorySyncServiceConfig({});

    expect(config).toMatchObject({
      internalRpc: {
        host: '127.0.0.1',
        port: 18082
      },
      services: {
        telegram: {
          url: 'http://127.0.0.1:18081'
        }
      }
    });
  });

  it('parses internal RPC service addresses', () => {
    const config = loadHistorySyncServiceConfig({
      HISTORY_RPC_HOST: '0.0.0.0',
      HISTORY_RPC_PORT: '8080',
      TELEGRAM_RPC_URL: 'http://telegram:8080'
    });

    expect(config.internalRpc).toEqual({
      host: '0.0.0.0',
      port: 8080
    });
    expect(config.services.telegram.url).toBe('http://telegram:8080');
  });
});
