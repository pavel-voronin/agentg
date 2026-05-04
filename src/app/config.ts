import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

export type AppConfig = {
  blobStore: {
    directory: string;
  };
  controlPlane: {
    enabled: boolean;
    host: string;
    port: number;
  };
  database: {
    path: string;
  };
  gateway: {
    enabled: boolean;
    host: string;
    port: number;
    token?: string;
  };
  gatewayCapabilities: {
    enabled: string[];
  };
  plugins: {
    enabled: string[];
  };
  tdlib: {
    apiHash?: string;
    apiId?: number;
    databaseDirectory: string;
    filesDirectory: string;
  };
};

export type LoadAppConfigInput = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

export function loadAppConfig(input: LoadAppConfigInput = {}): AppConfig {
  const cwd = input.cwd ?? process.cwd();
  const env = input.env ?? process.env;
  const dotenvDirectory = loadNearestDotenv(cwd);
  const baseDirectory = dotenvDirectory ?? cwd;
  const apiId = parseOptionalPositiveInteger(env.TELEGRAM_API_ID, 'TELEGRAM_API_ID');

  return {
    blobStore: {
      directory: resolveConfigPath(env.AGENTG_BLOB_STORE_DIR ?? './td-data/files', baseDirectory)
    },
    controlPlane: {
      enabled: parseBoolean(env.CONTROL_PLANE_ENABLED, false),
      host: env.CONTROL_PLANE_HOST ?? '127.0.0.1',
      port: parsePort(env.CONTROL_PLANE_PORT, 8789, 'CONTROL_PLANE_PORT')
    },
    database: {
      path: resolveConfigPath(env.AGENTG_SQLITE_PATH ?? './agentg.sqlite', baseDirectory)
    },
    gateway: {
      enabled: parseBoolean(env.GATEWAY_ENABLED, false),
      host: env.GATEWAY_HOST ?? '127.0.0.1',
      port: parsePort(env.GATEWAY_PORT, 8787, 'GATEWAY_PORT'),
      ...(env.GATEWAY_TOKEN === undefined ? {} : { token: env.GATEWAY_TOKEN })
    },
    gatewayCapabilities: {
      enabled: parseList(
        env.GATEWAY_CAPABILITIES ?? 'telegram.read,history.read,summaries.read,summaries.request'
      )
    },
    plugins: {
      enabled: parseList(env.AGENTG_PLUGINS)
    },
    tdlib: {
      ...(apiId === undefined ? {} : { apiId }),
      ...(env.TELEGRAM_API_HASH === undefined ? {} : { apiHash: env.TELEGRAM_API_HASH }),
      databaseDirectory: resolveConfigPath(
        env.TDLIB_DATABASE_DIR ?? './td-data/database',
        baseDirectory
      ),
      filesDirectory: resolveConfigPath(env.TDLIB_FILES_DIR ?? './td-data/files', baseDirectory)
    }
  };
}

function loadNearestDotenv(startDirectory: string): string | undefined {
  let directory = resolve(startDirectory);

  for (;;) {
    const candidate = resolve(directory, '.env');
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate, quiet: true });
      return directory;
    }

    const parent = dirname(directory);
    if (parent === directory) {
      loadDotenv({ quiet: true });
      return undefined;
    }

    directory = parent;
  }
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.length === 0) {
    return defaultValue;
  }

  if (value === '1' || value.toLowerCase() === 'true') {
    return true;
  }
  if (value === '0' || value.toLowerCase() === 'false') {
    return false;
  }

  throw new Error(`Boolean value must be true, false, 1, or 0: ${value}`);
}

function parseList(value: string | undefined): string[] {
  if (value === undefined || value.trim().length === 0) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseOptionalPositiveInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  return parsePositiveInteger(value, name);
}

function parsePort(value: string | undefined, defaultValue: number, name: string): number {
  return value === undefined || value.length === 0
    ? defaultValue
    : parsePositiveInteger(value, name);
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function resolveConfigPath(path: string, baseDirectory: string): string {
  return isAbsolute(path) ? path : resolve(baseDirectory, path);
}
