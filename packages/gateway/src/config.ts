import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

export const readConfig = defineConfig({
  host: string('GATEWAY_HOST').default('127.0.0.1'),
  natsUrl: string('NATS_URL'),
  port: number('GATEWAY_PORT').default(8787),
  rpcHost: string('HOST').optional(),
  rpcPort: number('PORT').default(8703),
  telegramRpcUrl: string('TELEGRAM_RPC_URL'),
  token: string('GATEWAY_TOKEN').optional()
});

export type Config = ConfigOf<typeof readConfig>;
