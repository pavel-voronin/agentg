import { loadNearestDotenv } from '@agentg/shared/dotenv';

import { DEFAULT_SERVICE_DIRECTORY_LEASE_TTL_MS } from './rpc/contracts.js';

loadNearestDotenv();

export type ServiceDirectoryBindConfig = {
  host: string;
  port: number;
};

export type ServiceDirectoryServiceConfig = {
  internalRpc: ServiceDirectoryBindConfig;
  leaseTtlMs: number;
  nats: {
    url: string;
  };
};

export function loadServiceDirectoryServiceConfig(
  env: NodeJS.ProcessEnv = process.env
): ServiceDirectoryServiceConfig {
  return {
    internalRpc: {
      host: env.SERVICE_DIRECTORY_RPC_HOST ?? '127.0.0.1',
      port:
        parseOptionalInteger(env.SERVICE_DIRECTORY_RPC_PORT, 'SERVICE_DIRECTORY_RPC_PORT') ?? 18084
    },
    leaseTtlMs:
      parseOptionalInteger(env.SERVICE_DIRECTORY_LEASE_TTL_MS, 'SERVICE_DIRECTORY_LEASE_TTL_MS') ??
      DEFAULT_SERVICE_DIRECTORY_LEASE_TTL_MS,
    nats: {
      url: env.NATS_URL ?? 'nats://localhost:4222'
    }
  };
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
