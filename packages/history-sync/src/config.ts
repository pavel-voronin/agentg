import { loadNearestDotenv } from '@agentg/infra/dotenv';

import {
  readInternalTrpcBindConfig,
  readInternalTrpcClientConfig,
  type InternalTrpcBindConfig,
  type InternalTrpcClientConfig
} from './rpc/config.js';

loadNearestDotenv();

export type HistorySyncServiceConfig = {
  sync: {
    chatLoadBatchSize: number;
    messageLimit: number;
    requestDelayMs: number;
    windowDays: number;
  };
  databaseUrl: string;
  nats: {
    url: string;
  };
  serviceRpcUrl: string;
  internalRpc: InternalTrpcBindConfig;
  services: {
    serviceDirectory: InternalTrpcClientConfig;
  };
};

export function loadHistorySyncServiceConfig(
  env: NodeJS.ProcessEnv = process.env
): HistorySyncServiceConfig {
  const internalRpc = readInternalTrpcBindConfig(env, {
    hostEnv: 'HISTORY_SYNC_RPC_HOST',
    portEnv: 'HISTORY_SYNC_RPC_PORT',
    defaultHost: '127.0.0.1',
    defaultPort: 18082
  });

  return {
    sync: {
      chatLoadBatchSize:
        parseOptionalInteger(
          env.HISTORY_SYNC_CHAT_LOAD_BATCH_SIZE,
          'HISTORY_SYNC_CHAT_LOAD_BATCH_SIZE'
        ) ?? 100,
      messageLimit:
        parseOptionalInteger(env.HISTORY_SYNC_MESSAGE_LIMIT, 'HISTORY_SYNC_MESSAGE_LIMIT') ?? 100,
      requestDelayMs:
        parseOptionalInteger(env.HISTORY_SYNC_REQUEST_DELAY_MS, 'HISTORY_SYNC_REQUEST_DELAY_MS') ??
        1000,
      windowDays:
        parseOptionalInteger(env.HISTORY_SYNC_WINDOW_DAYS, 'HISTORY_SYNC_WINDOW_DAYS') ?? 31
    },
    databaseUrl: env.DATABASE_URL ?? 'postgres://agentg:agentg@localhost:5432/agentg',
    nats: {
      url: env.NATS_URL ?? 'nats://localhost:4222'
    },
    internalRpc,
    serviceRpcUrl: readInternalTrpcClientConfig(env, {
      defaultUrl: defaultRpcUrl(internalRpc),
      urlEnv: 'HISTORY_SYNC_RPC_URL'
    }).url,
    services: {
      serviceDirectory: readInternalTrpcClientConfig(env, {
        urlEnv: 'SERVICE_DIRECTORY_RPC_URL',
        defaultUrl: 'http://127.0.0.1:18084'
      })
    }
  };
}

function defaultRpcUrl(config: InternalTrpcBindConfig): string {
  const host = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  return `http://${host}:${String(config.port)}`;
}

function parseOptionalInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}
