export type InternalTrpcBindConfig = {
  host: string;
  port: number;
};

export type InternalTrpcClientConfig = {
  url: string;
};

export function readInternalTrpcBindConfig(
  env: NodeJS.ProcessEnv,
  options: {
    defaultHost: string;
    defaultPort: number;
    hostEnv: string;
    portEnv: string;
  }
): InternalTrpcBindConfig {
  return {
    host: env[options.hostEnv] ?? options.defaultHost,
    port: parsePositiveInteger(env[options.portEnv], options.portEnv) ?? options.defaultPort
  };
}

export function readInternalTrpcClientConfig(
  env: NodeJS.ProcessEnv,
  options: {
    defaultUrl: string;
    urlEnv: string;
  }
): InternalTrpcClientConfig {
  return {
    url: parseInternalTrpcUrl(env[options.urlEnv] ?? options.defaultUrl, options.urlEnv)
  };
}

export function parseInternalTrpcUrl(value: string, name = 'RPC_URL'): string {
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

export function formatInternalTrpcBindAddress(config: InternalTrpcBindConfig): string {
  return `${config.host}:${String(config.port)}`;
}

function parsePositiveInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}
