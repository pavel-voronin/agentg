import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

export const readConfig = defineConfig({
  configDirectory: string('POLICY_CONFIG_DIR').default('./config/policies'),
  host: string('HOST').optional(),
  natsUrl: string('NATS_URL'),
  port: number('PORT').default(8705)
});

export type Config = ConfigOf<typeof readConfig>;
