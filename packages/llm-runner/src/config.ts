import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

export type ProfileConfig = Readonly<{
  adapter: 'openai-compatible';
  apiKey?: string | undefined;
  baseUrl: string;
  maxAttempts?: number | undefined;
  maxOutputTokens?: number | undefined;
  model: string;
  temperature?: number | undefined;
  timeoutMs?: number | undefined;
}>;

export type SourceResolverConfig = Readonly<{
  procedure: string;
  timeoutMs?: number | undefined;
  url: string;
}>;

const rawConfig = defineConfig({
  databaseUrl: string('DATABASE_URL'),
  host: string('HOST').optional(),
  natsUrl: string('NATS_URL'),
  port: number('PORT').default(8707),
  profilesJson: string('LLM_RUNNER_PROFILES').default('{}'),
  sourceResolversJson: string('LLM_RUNNER_SOURCE_RESOLVERS').default('{}'),
  telegramRpcUrl: string('TELEGRAM_RPC_URL').default('http://127.0.0.1:8702'),
  workerIntervalMs: number('LLM_RUNNER_WORKER_INTERVAL_MS').default(1_000)
});

type RawConfig = ConfigOf<typeof rawConfig>;

export type Config = Omit<RawConfig, 'profilesJson' | 'sourceResolversJson' | 'telegramRpcUrl'> & {
  readonly profiles: Readonly<Record<string, ProfileConfig>>;
  readonly sourceResolvers: Readonly<Record<string, SourceResolverConfig>>;
};

export function readConfig(...sources: Parameters<typeof rawConfig>): Config {
  const config = rawConfig(...sources);
  return {
    databaseUrl: config.databaseUrl,
    host: config.host,
    natsUrl: config.natsUrl,
    port: config.port,
    profiles: parseProfiles(config.profilesJson),
    sourceResolvers: withTelegramDefault(
      parseSourceResolvers(config.sourceResolversJson),
      config.telegramRpcUrl
    ),
    workerIntervalMs: config.workerIntervalMs
  };
}

function parseProfiles(raw: string): Readonly<Record<string, ProfileConfig>> {
  const parsed = parseObject(raw, 'LLM_RUNNER_PROFILES');
  const output: Record<string, ProfileConfig> = {};
  for (const [name, value] of Object.entries(parsed)) {
    assertName(name, 'profile');
    if (!isRecord(value)) {
      throw new Error(`LLM_RUNNER_PROFILES.${name} must be an object`);
    }
    if (value.adapter !== 'openai-compatible') {
      throw new Error(`LLM_RUNNER_PROFILES.${name}.adapter is not supported`);
    }
    const baseUrl = requiredString(value.baseUrl, `LLM_RUNNER_PROFILES.${name}.baseUrl`);
    const model = requiredString(value.model, `LLM_RUNNER_PROFILES.${name}.model`);
    output[name] = Object.freeze({
      adapter: 'openai-compatible',
      ...(typeof value.apiKey === 'string' && value.apiKey.length > 0
        ? { apiKey: value.apiKey }
        : {}),
      baseUrl,
      ...(positiveIntegerValue(value.maxAttempts) === undefined
        ? {}
        : { maxAttempts: positiveIntegerValue(value.maxAttempts) }),
      ...(numberValue(value.maxOutputTokens) === undefined
        ? {}
        : { maxOutputTokens: numberValue(value.maxOutputTokens) }),
      model,
      ...(numberValue(value.temperature) === undefined
        ? {}
        : { temperature: numberValue(value.temperature) }),
      ...(numberValue(value.timeoutMs) === undefined
        ? {}
        : { timeoutMs: numberValue(value.timeoutMs) })
    });
  }
  return Object.freeze(output);
}

function parseSourceResolvers(raw: string): Record<string, SourceResolverConfig> {
  const parsed = parseObject(raw, 'LLM_RUNNER_SOURCE_RESOLVERS');
  const output: Record<string, SourceResolverConfig> = {};
  for (const [domain, value] of Object.entries(parsed)) {
    assertDomain(domain);
    if (!isRecord(value)) {
      throw new Error(`LLM_RUNNER_SOURCE_RESOLVERS.${domain} must be an object`);
    }
    output[domain] = Object.freeze({
      procedure:
        typeof value.procedure === 'string' && value.procedure.length > 0
          ? value.procedure
          : 'resolveSourceContent',
      ...(numberValue(value.timeoutMs) === undefined
        ? {}
        : { timeoutMs: numberValue(value.timeoutMs) }),
      url: requiredString(value.url, `LLM_RUNNER_SOURCE_RESOLVERS.${domain}.url`)
    });
  }
  return output;
}

function withTelegramDefault(
  resolvers: Record<string, SourceResolverConfig>,
  url: string
): Readonly<Record<string, SourceResolverConfig>> {
  if (!Object.hasOwn(resolvers, 'telegram')) {
    resolvers.telegram = Object.freeze({
      procedure: 'resolveSourceContent',
      url
    });
  }
  return Object.freeze(resolvers);
}

function parseObject(raw: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed;
}

function assertName(value: string, label: string): void {
  if (!/^[a-z][A-Za-z0-9_.-]*$/.test(value)) {
    throw new Error(`LLM runner ${label} must be a named profile key: ${value}`);
  }
}

function assertDomain(value: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    throw new Error(`Source resolver domain must be kebab-case: ${value}`);
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function numberValue(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('LLM runner numeric profile fields must be finite numbers');
  }
  return value;
}

function positiveIntegerValue(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error('LLM runner retry profile fields must be positive integers');
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
