import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

export const readConfig = defineConfig({
  databaseUrl: string('DATABASE_URL'),
  grafanaUrl: string('GRAFANA_URL').default('http://127.0.0.1:3000'),
  host: string('CONTROL_PLANE_HOST').default('127.0.0.1'),
  jaegerUiUrl: string('JAEGER_UI_URL').default('http://127.0.0.1:16686'),
  natsUrl: string('NATS_URL'),
  port: number('CONTROL_PLANE_PORT').default(8789),
  registryUrl: string('REGISTRY_URL'),
  tdlibFilesDirectory: string('TDLIB_FILES_DIR').default('./td-data/files'),
  victoriaMetricsUrl: string('VICTORIA_METRICS_URL').default('http://127.0.0.1:8428')
});

export type Config = ConfigOf<typeof readConfig>;
