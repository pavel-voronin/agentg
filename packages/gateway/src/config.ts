import 'dotenv/config';

export type InternalServiceConfig = {
  url: string;
};

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
    extensionRegistry?: InternalServiceConfig;
    extensions: {
      summaries?: InternalServiceConfig | undefined;
    };
    history: InternalServiceConfig;
    telegram: InternalServiceConfig;
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
      ...(env.EXTENSION_REGISTRY_RPC_URL === undefined ||
      env.EXTENSION_REGISTRY_RPC_URL.length === 0
        ? {}
        : {
            extensionRegistry: readInternalServiceConfig(env, {
              urlEnv: 'EXTENSION_REGISTRY_RPC_URL',
              defaultUrl: env.EXTENSION_REGISTRY_RPC_URL
            })
          }),
      extensions: {
        ...(env.SUMMARIES_RPC_URL === undefined || env.SUMMARIES_RPC_URL.length === 0
          ? {}
          : {
              summaries: readInternalServiceConfig(env, {
                urlEnv: 'SUMMARIES_RPC_URL',
                defaultUrl: env.SUMMARIES_RPC_URL
              })
            })
      },
      history: readInternalServiceConfig(env, {
        urlEnv: 'HISTORY_RPC_URL',
        defaultUrl: 'http://127.0.0.1:18082'
      }),
      telegram: readInternalServiceConfig(env, {
        urlEnv: 'TELEGRAM_RPC_URL',
        defaultUrl: 'http://127.0.0.1:18081'
      })
    }
  };
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
