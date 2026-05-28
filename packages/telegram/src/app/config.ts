import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadNearestDotenv } from '@agentg/infra/dotenv';

import {
  readInternalTrpcBindConfig,
  readInternalTrpcClientConfig,
  type InternalTrpcBindConfig,
  type InternalTrpcClientConfig
} from '@agentg/rpc/config';
import type { TelegramClientConfig } from '../tdlib/client.js';

const dotenvDirectory = loadNearestDotenv();
const defaultConfigDirectory =
  dotenvDirectory ?? fileURLToPath(new URL('../../..', import.meta.url));

export type TelegramIngestionConfig = {
  databaseUrl: string;
  nats: {
    url: string;
  };
  internalRpc: InternalTrpcBindConfig;
  serviceRpcUrl: string;
  services: {
    serviceDirectory: InternalTrpcClientConfig;
  };
  telegram: TelegramClientConfig;
};

export function loadTelegramIngestionConfig(
  env: NodeJS.ProcessEnv = process.env
): TelegramIngestionConfig {
  const apiId = parseOptionalInteger(env.TELEGRAM_API_ID, 'TELEGRAM_API_ID');
  const internalRpc = readInternalTrpcBindConfig(env, {
    hostEnv: 'TELEGRAM_RPC_HOST',
    portEnv: 'TELEGRAM_RPC_PORT',
    defaultHost: '127.0.0.1',
    defaultPort: 18081
  });

  return {
    databaseUrl: env.DATABASE_URL ?? 'postgres://agentg:agentg@localhost:5432/agentg',
    nats: {
      url: env.NATS_URL ?? 'nats://localhost:4222'
    },
    internalRpc,
    serviceRpcUrl: readInternalTrpcClientConfig(env, {
      defaultUrl: defaultRpcUrl(internalRpc),
      urlEnv: 'TELEGRAM_RPC_URL'
    }).url,
    services: {
      serviceDirectory: readInternalTrpcClientConfig(env, {
        defaultUrl: 'http://127.0.0.1:18084',
        urlEnv: 'SERVICE_DIRECTORY_RPC_URL'
      })
    },
    telegram: {
      ...(apiId === undefined ? {} : { apiId }),
      ...(env.TELEGRAM_API_HASH === undefined ? {} : { apiHash: env.TELEGRAM_API_HASH }),
      databaseDirectory: resolveConfigPath(env.TDLIB_DATABASE_DIR ?? './td-data/database'),
      filesDirectory: resolveConfigPath(env.TDLIB_FILES_DIR ?? './td-data/files')
    }
  };
}

function defaultRpcUrl(config: InternalTrpcBindConfig): string {
  const host = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  return `http://${host}:${String(config.port)}`;
}

function resolveConfigPath(path: string): string {
  if (isAbsolute(path)) {
    return path;
  }

  return resolve(defaultConfigDirectory, path);
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
