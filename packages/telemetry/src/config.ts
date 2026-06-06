import { defineConfig, number, string } from '@agentg/framework';

export const readConfig = defineConfig({
  host: string('HOST').optional(),
  natsMonitoringTimeoutMs: number('NATS_MONITORING_TIMEOUT_MS').default(1000),
  natsMonitoringUrl: string('NATS_MONITORING_URL').default('http://127.0.0.1:8222'),
  natsUrl: string('NATS_URL'),
  port: number('PORT').default(8705),
  registryUrl: string('REGISTRY_URL'),
  reportIntervalMs: number('AGENTG_TELEMETRY_REPORT_INTERVAL_MS').default(2000),
  storagePath: string('AGENTG_TELEMETRY_SQLITE_PATH').default('.tmp/telemetry/events.sqlite')
});
