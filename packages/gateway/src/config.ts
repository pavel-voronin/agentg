import 'dotenv/config';

export type InternalServiceConfig = {
  url: string;
};

export type GatewayConfig = {
  gateway: {
    host: string;
    port: number;
    serviceUrl: string;
    token?: string;
  };
  nats: {
    url: string;
  };
  services: {
    serviceDirectory: InternalServiceConfig;
  };
};

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  return {
    gateway: {
      host: env.AGENT_GATEWAY_HOST ?? '127.0.0.1',
      port: parseOptionalInteger(env.AGENT_GATEWAY_PORT, 'AGENT_GATEWAY_PORT') ?? 8787,
      serviceUrl: parseInternalServiceUrl(
        env.AGENT_GATEWAY_URL ?? defaultServiceUrl(
          env.AGENT_GATEWAY_HOST ?? '127.0.0.1',
          parseOptionalInteger(env.AGENT_GATEWAY_PORT, 'AGENT_GATEWAY_PORT') ?? 8787
        ),
        'AGENT_GATEWAY_URL'
      ),
      ...(env.AGENT_GATEWAY_TOKEN === undefined ? {} : { token: env.AGENT_GATEWAY_TOKEN })
    },
    nats: {
      url: env.NATS_URL ?? 'nats://localhost:4222'
    },
    services: {
      serviceDirectory: readInternalServiceConfig(env, {
        urlEnv: 'SERVICE_DIRECTORY_RPC_URL',
        defaultUrl: 'http://127.0.0.1:18084'
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
