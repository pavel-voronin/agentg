import 'dotenv/config';

import { resolve } from 'node:path';

type InternalServiceConfig = {
  url: string;
};

export type ControlPlaneConfig = {
  controlPlane: {
    host: string;
    port: number;
    serviceUrl: string;
    staticDir: string;
  };
  nats: {
    url: string;
  };
  services: {
    serviceDirectory: InternalServiceConfig;
  };
};

export function loadControlPlaneConfig(env: NodeJS.ProcessEnv = process.env): ControlPlaneConfig {
  const host = env.CONTROL_PLANE_HOST ?? '127.0.0.1';
  const port =
    parseOptionalInteger(env.CONTROL_PLANE_PORT, 'CONTROL_PLANE_PORT') ??
    defaultControlPlanePort(env);

  return {
    controlPlane: {
      host,
      port,
      serviceUrl: parseInternalServiceUrl(
        env.CONTROL_PLANE_URL ?? defaultServiceUrl(host, port),
        'CONTROL_PLANE_URL'
      ),
      staticDir: resolve(env.CONTROL_PLANE_STATIC_DIR ?? 'dist')
    },
    nats: {
      url: env.NATS_URL ?? 'nats://localhost:4222'
    },
    services: {
      serviceDirectory: readInternalServiceConfig(env, {
        defaultUrl: 'http://127.0.0.1:18084',
        urlEnv: 'SERVICE_DIRECTORY_RPC_URL'
      })
    }
  };
}

function defaultServiceUrl(host: string, port: number): string {
  return `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${String(port)}`;
}

function readInternalServiceConfig(
  env: NodeJS.ProcessEnv,
  options: {
    defaultUrl: string;
    urlEnv: string;
  }
): InternalServiceConfig {
  return {
    url: parseInternalServiceUrl(env[options.urlEnv] ?? options.defaultUrl, options.urlEnv)
  };
}

function parseInternalServiceUrl(value: string, name: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(`${name} must be a valid http(s) URL`, { cause: error });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must use http or https`);
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error(`${name} must not include credentials`);
  }

  if (url.pathname !== '/' || url.search.length > 0 || url.hash.length > 0) {
    throw new Error(`${name} must point to a service root`);
  }

  return url.toString().replace(/\/$/, '');
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
