import 'dotenv/config';

import {
  readInternalTrpcClientConfig,
  type InternalTrpcClientConfig
} from '@agentg/history-sync/rpc';

export type GatewayConfig = {
  databaseUrl: string;
  gateway: {
    host: string;
    port: number;
    token?: string;
  };
  nats: {
    url: string;
  };
  services: {
    history: InternalTrpcClientConfig;
  };
};

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  return {
    databaseUrl: env.DATABASE_URL ?? 'postgres://agentg:agentg@localhost:5432/agentg',
    gateway: {
      host: env.AGENT_GATEWAY_HOST ?? '127.0.0.1',
      port: parseOptionalInteger(env.AGENT_GATEWAY_PORT, 'AGENT_GATEWAY_PORT') ?? 8787,
      ...(env.AGENT_GATEWAY_TOKEN === undefined ? {} : { token: env.AGENT_GATEWAY_TOKEN })
    },
    nats: {
      url: env.NATS_URL ?? 'nats://localhost:4222'
    },
    services: {
      history: readInternalTrpcClientConfig(env, {
        urlEnv: 'HISTORY_RPC_URL',
        defaultUrl: 'http://127.0.0.1:18082'
      })
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
