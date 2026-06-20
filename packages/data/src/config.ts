import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

const rawConfig = defineConfig({
  databaseUrl: string('DATABASE_URL'),
  dispatchTimeoutMs: number('DATA_PROVIDER_TIMEOUT_MS').default(30_000),
  host: string('HOST').optional(),
  natsUrl: string('NATS_URL'),
  port: number('PORT').default(8708),
  providerTargetsJson: string('DATA_PROVIDER_TARGETS').default(
    '{"telegram":"http://127.0.0.1:8702"}'
  )
});

type RawConfig = ConfigOf<typeof rawConfig>;

export type Config = Omit<RawConfig, 'providerTargetsJson'> & {
  readonly providerTargets: Readonly<Record<string, string>>;
};

export function readConfig(...sources: Parameters<typeof rawConfig>): Config {
  const config = rawConfig(...sources);
  return {
    databaseUrl: config.databaseUrl,
    dispatchTimeoutMs: config.dispatchTimeoutMs,
    host: config.host,
    natsUrl: config.natsUrl,
    port: config.port,
    providerTargets: parseProviderTargets(config.providerTargetsJson)
  };
}

function parseProviderTargets(raw: string): Readonly<Record<string, string>> {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('DATA_PROVIDER_TARGETS must be a JSON object');
  }
  const output: Record<string, string> = {};
  for (const [provider, url] of Object.entries(parsed)) {
    if (!/^[a-z][a-z0-9-]*$/.test(provider)) {
      throw new Error(`DATA_PROVIDER_TARGETS provider must be kebab-case: ${provider}`);
    }
    if (typeof url !== 'string' || url.trim().length === 0) {
      throw new Error(`DATA_PROVIDER_TARGETS url must be a non-empty string: ${provider}`);
    }
    output[provider] = url;
  }
  return Object.freeze(output);
}
