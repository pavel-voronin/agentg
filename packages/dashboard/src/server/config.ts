import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

export const readConfig = defineConfig({
  databaseUrl: string('DATABASE_URL'),
  grafanaUrl: string('GRAFANA_URL').default('http://127.0.0.1:3000'),
  host: string('DASHBOARD_HOST').default('127.0.0.1'),
  jaegerUiUrl: string('JAEGER_UI_URL').default('http://127.0.0.1:16686'),
  natsUrl: string('NATS_URL'),
  port: number('DASHBOARD_PORT').default(8789),
  registryUrl: string('REGISTRY_URL'),
  victoriaMetricsUrl: string('VICTORIA_METRICS_URL').default('http://127.0.0.1:8428')
});

export type Config = ConfigOf<typeof readConfig>;
