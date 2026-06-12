import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

const databaseUrl = string('DATABASE_URL');

export const readConfig = defineConfig({
  chatLoadBatchSize: number('HISTORY_SYNC_CHAT_LOAD_BATCH_SIZE').default(100),
  databaseUrl,
  host: string('HOST').optional(),
  messageLimit: number('HISTORY_SYNC_MESSAGE_LIMIT').default(100),
  natsUrl: string('NATS_URL'),
  port: number('PORT').default(8704),
  reconcileIntervalMs: number('HISTORY_SYNC_RECONCILE_INTERVAL_MS').default(60000),
  requestDelayMs: number('HISTORY_SYNC_REQUEST_DELAY_MS').default(1000),
  telegramRpcUrl: string('TELEGRAM_RPC_URL'),
  windowDays: number('HISTORY_SYNC_WINDOW_DAYS').default(31)
});

export type Config = ConfigOf<typeof readConfig>;

export const readDatabaseConfig = defineConfig({
  databaseUrl
});
