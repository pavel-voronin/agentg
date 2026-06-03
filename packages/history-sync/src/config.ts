import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

export const readConfig = defineConfig({
  chatLoadBatchSize: number('HISTORY_SYNC_CHAT_LOAD_BATCH_SIZE').default(100),
  databaseUrl: string('DATABASE_URL'),
  host: string('HOST').optional(),
  messageLimit: number('HISTORY_SYNC_MESSAGE_LIMIT').default(100),
  natsUrl: string('NATS_URL'),
  port: number('PORT').default(8704),
  registryUrl: string('REGISTRY_URL'),
  requestDelayMs: number('HISTORY_SYNC_REQUEST_DELAY_MS').default(1000),
  windowDays: number('HISTORY_SYNC_WINDOW_DAYS').default(31)
});

export type Config = ConfigOf<typeof readConfig>;
