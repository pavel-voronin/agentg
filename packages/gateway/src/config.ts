import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';

export const readConfig = defineConfig({
  host: string('GATEWAY_HOST').default('127.0.0.1'),
  natsUrl: string('NATS_URL'),
  port: number('GATEWAY_PORT').default(8787),
  registryUrl: string('REGISTRY_URL'),
  rpcHost: string('HOST').optional(),
  rpcPort: number('PORT').default(8703),
  token: string('GATEWAY_TOKEN').optional()
});

export type Config = ConfigOf<typeof readConfig>;
