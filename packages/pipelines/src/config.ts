import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

const rawConfig = defineConfig({
  actionTargetsJson: string('PIPELINES_ACTION_TARGETS').default(
    '{"data":"http://127.0.0.1:8708","llm-runner":"http://127.0.0.1:8707"}'
  ),
  actionTimeoutMs: number('PIPELINES_ACTION_TIMEOUT_MS').default(120_000),
  databaseUrl: string('DATABASE_URL'),
  host: string('HOST').optional(),
  natsUrl: string('NATS_URL'),
  policiesRpcUrl: string('POLICIES_RPC_URL').default('http://127.0.0.1:8705'),
  port: number('PORT').default(8709),
  triggersRpcUrl: string('TRIGGERS_RPC_URL').default('http://127.0.0.1:8706')
});

type RawConfig = ConfigOf<typeof rawConfig>;

export type Config = Omit<RawConfig, 'actionTargetsJson'> & {
  readonly actionTargets: Readonly<Record<string, string>>;
};

export function readConfig(...sources: Parameters<typeof rawConfig>): Config {
  const config = rawConfig(...sources);
  return {
    actionTargets: parseTargets(config.actionTargetsJson),
    actionTimeoutMs: config.actionTimeoutMs,
    databaseUrl: config.databaseUrl,
    host: config.host,
    natsUrl: config.natsUrl,
    policiesRpcUrl: config.policiesRpcUrl,
    port: config.port,
    triggersRpcUrl: config.triggersRpcUrl
  };
}

function parseTargets(raw: string): Readonly<Record<string, string>> {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('PIPELINES_ACTION_TARGETS must be a JSON object');
  }
  const output: Record<string, string> = {};
  for (const [module, url] of Object.entries(parsed)) {
    if (!/^[a-z][a-z0-9-]*$/.test(module)) {
      throw new Error(`PIPELINES_ACTION_TARGETS module must be kebab-case: ${module}`);
    }
    if (typeof url !== 'string' || url.trim().length === 0) {
      throw new Error(`PIPELINES_ACTION_TARGETS url must be a non-empty string: ${module}`);
    }
    output[module] = url;
  }
  return Object.freeze(output);
}
