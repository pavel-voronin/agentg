import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

export const readConfig = defineConfig({
  host: string('HOST').optional(),
  natsUrl: string('NATS_URL'),
  port: number('PORT').default(8701)
});

export type Config = ConfigOf<typeof readConfig>;
