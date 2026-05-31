import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

export const readConfig = defineConfig({
  databaseUrl: string('DATABASE_URL'),
  host: string('CONTROL_PLANE_HOST').default('127.0.0.1'),
  natsUrl: string('NATS_URL'),
  port: number('CONTROL_PLANE_PORT').default(8789),
  registryUrl: string('REGISTRY_URL'),
  tdlibFilesDirectory: string('TDLIB_FILES_DIR').default('./td-data/files')
});

export type Config = ConfigOf<typeof readConfig>;
