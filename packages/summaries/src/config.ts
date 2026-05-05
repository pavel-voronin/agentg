import { loadDatabaseCliConfig } from '@agentg/database/config';
import { loadNearestDotenv } from '@agentg/shared/dotenv';
import { loadModuleRuntimeConfig, type ModuleRuntimeConfig } from '@agentg/shared/modules/runtime';

import type { SummariesRpcBindConfig } from './rpc/server.js';

loadNearestDotenv();

export type SummariesServiceConfig = {
  databaseUrl: string;
  internalRpc: SummariesRpcBindConfig;
  module: ModuleRuntimeConfig;
  nats: {
    url: string;
  };
  services: {
    serviceDirectory: {
      url: string;
    };
  };
};

export function loadSummariesServiceConfig(
  env: NodeJS.ProcessEnv = process.env
): SummariesServiceConfig {
  const databaseConfig = loadDatabaseCliConfig(env);
  const bind = {
    host: env.SUMMARIES_RPC_HOST ?? env.MODULE_RPC_HOST ?? '127.0.0.1',
    port:
      parseOptionalInteger(env.SUMMARIES_RPC_PORT, 'SUMMARIES_RPC_PORT') ??
      parseOptionalInteger(env.MODULE_RPC_PORT, 'MODULE_RPC_PORT') ??
      18083
  };
  const natsUrl = env.NATS_URL ?? 'nats://localhost:4222';
  const serviceRpcUrl =
    env.MODULE_RPC_URL ??
    `http://${bind.host === '0.0.0.0' ? '127.0.0.1' : bind.host}:${String(bind.port)}`;
  const serviceDirectoryUrl = parseHttpUrl(
    env.SERVICE_DIRECTORY_RPC_URL ?? 'http://127.0.0.1:18084',
    'SERVICE_DIRECTORY_RPC_URL'
  );

  return {
    databaseUrl: databaseConfig.databaseUrl,
    internalRpc: bind,
    module: loadModuleRuntimeConfig(env, {
      databaseUrl: databaseConfig.databaseUrl,
      extensions: [
        {
          extension: 'summaries.chatSummary',
          target: 'telegram.chat'
        }
      ],
      migrationFolder: env.MODULE_MIGRATION_FOLDER ?? 'packages/summaries/drizzle',
      natsUrl,
      serviceRpcUrl,
      slug: 'summaries',
      tablePrefix: 'summaries_'
    }),
    nats: {
      url: natsUrl
    },
    services: {
      serviceDirectory: {
        url: serviceDirectoryUrl
      }
    }
  };
}

function parseHttpUrl(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(`${name} must be a valid http(s) URL`, { cause: error });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must use http or https`);
  }

  return url.toString().replace(/\/$/, '');
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
