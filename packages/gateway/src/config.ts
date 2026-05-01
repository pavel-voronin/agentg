import 'dotenv/config';

import {
  readInternalTrpcClientConfig,
  type InternalTrpcClientConfig
} from '@agentg/history-sync/rpc';
import {
  readInternalTrpcClientConfig as readTelegramInternalTrpcClientConfig,
  type InternalTrpcClientConfig as TelegramInternalTrpcClientConfig
} from '@agentg/telegram/rpc';

export type GatewayConfig = {
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
    telegram: TelegramInternalTrpcClientConfig;
  };
};

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  return {
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
      }),
      telegram: readTelegramInternalTrpcClientConfig(env, {
        urlEnv: 'TELEGRAM_RPC_URL',
        defaultUrl: 'http://127.0.0.1:18081'
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
