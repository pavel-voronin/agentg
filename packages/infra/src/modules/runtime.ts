import { z } from 'zod';

const nonEmptyStringSchema = z.string().trim().min(1);

export const moduleExtensionDeclarationSchema = z.object({
  extension: nonEmptyStringSchema,
  target: nonEmptyStringSchema
});

export const moduleRuntimeConfigSchema = z.object({
  databaseUrl: nonEmptyStringSchema,
  extensions: z.array(moduleExtensionDeclarationSchema).default([]),
  migrationFolder: nonEmptyStringSchema,
  natsUrl: nonEmptyStringSchema,
  serviceRpcUrl: nonEmptyStringSchema,
  slug: nonEmptyStringSchema,
  tablePrefix: nonEmptyStringSchema
});

export type ModuleRuntimeConfig = z.output<typeof moduleRuntimeConfigSchema>;
export type ModuleExtensionDeclaration = z.output<typeof moduleExtensionDeclarationSchema>;

export type ModuleRuntimeConfigEnvironment = Record<string, string | undefined>;

export type ModuleRuntimeConfigOverrides = Partial<{
  databaseUrl: string;
  extensions: ModuleExtensionDeclaration[];
  migrationFolder: string;
  natsUrl: string;
  serviceRpcUrl: string;
  slug: string;
  tablePrefix: string;
}>;

export type ModuleStartupHooks<TDatabase, TEventBus, TRpcServer> = {
  connectEventBus?: ((config: ModuleRuntimeConfig) => Promise<TEventBus>) | undefined;
  createDatabaseClient?: ((config: ModuleRuntimeConfig) => Promise<TDatabase>) | undefined;
  runHealthCheck?: ((config: ModuleRuntimeConfig) => Promise<void>) | undefined;
  startTrpcServer?: ((config: ModuleRuntimeConfig) => Promise<TRpcServer>) | undefined;
};

export type StartedModuleRuntime<TDatabase, TEventBus, TRpcServer> = {
  databaseClient?: TDatabase | undefined;
  eventBus?: TEventBus | undefined;
  rpcServer?: TRpcServer | undefined;
};

export function loadModuleRuntimeConfig(
  env: ModuleRuntimeConfigEnvironment,
  overrides: ModuleRuntimeConfigOverrides = {}
): ModuleRuntimeConfig {
  const slug = overrides.slug ?? requireEnv(env, 'MODULE_SLUG');

  return moduleRuntimeConfigSchema.parse({
    databaseUrl: overrides.databaseUrl ?? requireEnv(env, 'DATABASE_URL'),
    extensions: overrides.extensions ?? [],
    migrationFolder:
      overrides.migrationFolder ?? env.MODULE_MIGRATION_FOLDER ?? `packages/${slug}/drizzle`,
    natsUrl: overrides.natsUrl ?? requireEnv(env, 'NATS_URL'),
    serviceRpcUrl: overrides.serviceRpcUrl ?? requireEnv(env, 'MODULE_RPC_URL'),
    slug,
    tablePrefix: overrides.tablePrefix ?? env.MODULE_TABLE_PREFIX ?? `${slug}_`
  });
}

export async function startTrustedModuleRuntime<TDatabase, TEventBus, TRpcServer>(
  config: ModuleRuntimeConfig,
  hooks: ModuleStartupHooks<TDatabase, TEventBus, TRpcServer>
): Promise<StartedModuleRuntime<TDatabase, TEventBus, TRpcServer>> {
  await hooks.runHealthCheck?.(config);
  const databaseClient = await hooks.createDatabaseClient?.(config);
  const eventBus = await hooks.connectEventBus?.(config);
  const rpcServer = await hooks.startTrpcServer?.(config);

  return {
    ...(databaseClient === undefined ? {} : { databaseClient }),
    ...(eventBus === undefined ? {} : { eventBus }),
    ...(rpcServer === undefined ? {} : { rpcServer })
  };
}

function requireEnv(env: ModuleRuntimeConfigEnvironment, name: string): string {
  const value = env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing required module runtime environment variable: ${name}`);
  }

  return value;
}
