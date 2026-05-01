import { isAbsolute, resolve } from 'node:path';

import { loadNearestDotenv } from '@agentg/shared/dotenv';

import type { TelegramClientConfig } from './tdlib.js';

const dotenvDirectory = loadNearestDotenv();

export type TelegramIngestionConfig = {
  databaseUrl: string;
  nats: {
    url: string;
  };
  telegram: TelegramClientConfig;
};

export function loadTelegramIngestionConfig(
  env: NodeJS.ProcessEnv = process.env
): TelegramIngestionConfig {
  const apiId = parseOptionalInteger(env.TELEGRAM_API_ID, 'TELEGRAM_API_ID');

  return {
    databaseUrl: env.DATABASE_URL ?? 'postgres://agentg:agentg@localhost:5432/agentg',
    nats: {
      url: env.NATS_URL ?? 'nats://localhost:4222'
    },
    telegram: {
      ...(apiId === undefined ? {} : { apiId }),
      ...(env.TELEGRAM_API_HASH === undefined ? {} : { apiHash: env.TELEGRAM_API_HASH }),
      databaseDirectory: resolveConfigPath(env.TDLIB_DATABASE_DIR ?? './td-data/database'),
      filesDirectory: resolveConfigPath(env.TDLIB_FILES_DIR ?? './td-data/files')
    }
  };
}

function resolveConfigPath(path: string): string {
  if (isAbsolute(path)) {
    return path;
  }

  return resolve(dotenvDirectory ?? process.cwd(), path);
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
