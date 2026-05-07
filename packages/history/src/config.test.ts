import { describe, expect, it } from 'vitest';

import { loadHistoryServiceConfig } from './config.js';

describe('loadHistoryServiceConfig', () => {
  it('uses local RPC defaults', () => {
    const config = loadHistoryServiceConfig({});

    expect(config).toMatchObject({
      internalRpc: {
        host: '127.0.0.1',
        port: 18082
      },
      serviceRpcUrl: 'http://127.0.0.1:18082',
      services: {
        serviceDirectory: {
          url: 'http://127.0.0.1:18084'
        }
      }
    });
  });

  it('parses internal RPC service addresses', () => {
    const config = loadHistoryServiceConfig({
      HISTORY_RPC_HOST: '0.0.0.0',
      HISTORY_RPC_PORT: '8080',
      HISTORY_RPC_URL: 'http://history:8080',
      SERVICE_DIRECTORY_RPC_URL: 'http://service-directory:8080'
    });

    expect(config.internalRpc).toEqual({
      host: '0.0.0.0',
      port: 8080
    });
    expect(config.serviceRpcUrl).toBe('http://history:8080');
    expect(config.services.serviceDirectory.url).toBe('http://service-directory:8080');
  });
});
