export type InternalRpcBindConfig = {
  host: string;
  port: number;
};

export type InternalRpcClientConfig = {
  url: string;
};

export function readInternalRpcBindConfig(
  env: NodeJS.ProcessEnv,
  options: {
    hostEnv: string;
    portEnv: string;
    defaultHost: string;
    defaultPort: number;
  }
): InternalRpcBindConfig {
  return {
    host: env[options.hostEnv] ?? options.defaultHost,
    port: parsePositiveInteger(env[options.portEnv], options.portEnv) ?? options.defaultPort
  };
}

export function readInternalRpcClientConfig(
  env: NodeJS.ProcessEnv,
  options: {
    urlEnv: string;
    defaultUrl: string;
  }
): InternalRpcClientConfig {
  return {
    url: parseInternalRpcUrl(env[options.urlEnv] ?? options.defaultUrl, options.urlEnv)
  };
}

export function parseInternalRpcUrl(value: string, name = 'RPC_URL'): string {
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

export function grpcTargetFromInternalRpcUrl(value: string, name = 'RPC_URL'): string {
  const url = new URL(parseInternalRpcUrl(value, name));

  return url.host;
}

export function formatInternalRpcBindAddress(config: InternalRpcBindConfig): string {
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
