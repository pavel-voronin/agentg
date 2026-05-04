import 'dotenv/config';

import {
  readInternalTrpcClientConfig as readHistoryInternalTrpcClientConfig,
  type InternalTrpcClientConfig as HistoryInternalTrpcClientConfig
} from '@agentg/history-sync/rpc';
import {
  readInternalTrpcClientConfig as readTelegramInternalTrpcClientConfig,
  type InternalTrpcClientConfig as TelegramInternalTrpcClientConfig
} from '@agentg/telegram/rpc';
import { resolve } from 'node:path';

export type ControlPlaneConfig = {
  controlPlane: {
    host: string;
    port: number;
    staticDir: string;
  };
  nats: {
    url: string;
  };
  services: {
    history: HistoryInternalTrpcClientConfig;
    telegram: TelegramInternalTrpcClientConfig;
  };
};

export function loadControlPlaneConfig(env: NodeJS.ProcessEnv = process.env): ControlPlaneConfig {
  return {
    controlPlane: {
      host: env.CONTROL_PLANE_HOST ?? '127.0.0.1',
      port:
        parseOptionalInteger(env.CONTROL_PLANE_PORT, 'CONTROL_PLANE_PORT') ??
        defaultControlPlanePort(env),
      staticDir: resolve(env.CONTROL_PLANE_STATIC_DIR ?? 'dist')
    },
    nats: {
      url: env.NATS_URL ?? 'nats://localhost:4222'
    },
    services: {
      history: readHistoryInternalTrpcClientConfig(env, {
        defaultUrl: 'http://127.0.0.1:18082',
        urlEnv: 'HISTORY_RPC_URL'
      }),
      telegram: readTelegramInternalTrpcClientConfig(env, {
        defaultUrl: 'http://127.0.0.1:18081',
        urlEnv: 'TELEGRAM_RPC_URL'
      })
    }
  };
}

function defaultControlPlanePort(env: NodeJS.ProcessEnv): number {
  return env.NODE_ENV === 'production' ? 8788 : 8789;
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
