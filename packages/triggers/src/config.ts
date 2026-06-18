import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

const rawConfig = defineConfig({
  actionTargetsJson: string('TRIGGERS_ACTION_TARGETS').default(
    '{"llm-runner":"http://127.0.0.1:8707"}'
  ),
  databaseUrl: string('DATABASE_URL'),
  dispatchTimeoutMs: number('TRIGGERS_DISPATCH_TIMEOUT_MS').default(30_000),
  host: string('HOST').optional(),
  leaseSeconds: number('TRIGGERS_LEASE_SECONDS').default(60),
  lookbackSeconds: number('TRIGGERS_LOOKBACK_SECONDS').default(86_400),
  maxDispatchAttempts: number('TRIGGERS_MAX_DISPATCH_ATTEMPTS').default(3),
  natsUrl: string('NATS_URL'),
  policiesRpcUrl: string('POLICIES_RPC_URL'),
  port: number('PORT').default(8706),
  schedulerIntervalMs: number('TRIGGERS_SCHEDULER_INTERVAL_MS').default(1_000)
});

type RawConfig = ConfigOf<typeof rawConfig>;

export type Config = Omit<RawConfig, 'actionTargetsJson'> & {
  readonly actionTargets: Readonly<Record<string, string>>;
};

export function readConfig(...sources: Parameters<typeof rawConfig>): Config {
  const config = rawConfig(...sources);
  return {
    ...config,
    actionTargets: parseActionTargets(config.actionTargetsJson)
  };
}

function parseActionTargets(raw: string): Readonly<Record<string, string>> {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('TRIGGERS_ACTION_TARGETS must be a JSON object');
  }

  const output: Record<string, string> = {};
  for (const [module, url] of Object.entries(parsed)) {
    if (!/^[a-z][a-z0-9-]*$/.test(module)) {
      throw new Error(`TRIGGERS_ACTION_TARGETS module must be kebab-case: ${module}`);
    }
    if (typeof url !== 'string' || url.trim().length === 0) {
      throw new Error(`TRIGGERS_ACTION_TARGETS url must be a non-empty string: ${module}`);
    }
    output[module] = url;
  }
  return Object.freeze(output);
}
