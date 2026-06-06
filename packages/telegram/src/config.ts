import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

const databaseUrl = string('DATABASE_URL');

export const readConfig = defineConfig({
  apiHash: string('TELEGRAM_API_HASH').optional(),
  apiId: number('TELEGRAM_API_ID').optional(),
  databaseUrl,
  host: string('HOST').optional(),
  ingestionUpdateConcurrency: number('TELEGRAM_INGESTION_UPDATE_CONCURRENCY').default(10),
  natsUrl: string('NATS_URL'),
  port: number('PORT').default(8702),
  registryUrl: string('REGISTRY_URL'),
  tdlibDatabaseDirectory: string('TDLIB_DATABASE_DIR').default('./td-data/database'),
  tdlibFilesDirectory: string('TDLIB_FILES_DIR').default('./td-data/files')
});

export type Config = ConfigOf<typeof readConfig>;

export const readAuthConfig = defineConfig({
  apiHash: string('TELEGRAM_API_HASH').optional(),
  apiId: number('TELEGRAM_API_ID').optional(),
  tdlibDatabaseDirectory: string('TDLIB_DATABASE_DIR').default('./td-data/database'),
  tdlibFilesDirectory: string('TDLIB_FILES_DIR').default('./td-data/files')
});

export type AuthConfig = ConfigOf<typeof readAuthConfig>;

export const readDatabaseConfig = defineConfig({
  databaseUrl
});

export type DatabaseConfig = ConfigOf<typeof readDatabaseConfig>;
