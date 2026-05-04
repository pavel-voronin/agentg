import { loadNearestDotenv } from '@agentg/shared/dotenv';
import { DEFAULT_EXTENSION_REGISTRATION_TTL_MS } from '@agentg/shared/rpc/extensions';

loadNearestDotenv();

export type ExtensionRegistryBindConfig = {
  host: string;
  port: number;
};

export type ExtensionRegistryServiceConfig = {
  internalRpc: ExtensionRegistryBindConfig;
  registrationTtlMs: number;
};

export function loadExtensionRegistryServiceConfig(
  env: NodeJS.ProcessEnv = process.env
): ExtensionRegistryServiceConfig {
  return {
    internalRpc: {
      host: env.EXTENSION_REGISTRY_RPC_HOST ?? '127.0.0.1',
      port:
        parseOptionalInteger(env.EXTENSION_REGISTRY_RPC_PORT, 'EXTENSION_REGISTRY_RPC_PORT') ??
        18084
    },
    registrationTtlMs:
      parseOptionalInteger(
        env.EXTENSION_REGISTRY_REGISTRATION_TTL_MS,
        'EXTENSION_REGISTRY_REGISTRATION_TTL_MS'
      ) ?? DEFAULT_EXTENSION_REGISTRATION_TTL_MS
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
