import { z } from 'zod';

import {
  capabilityRegistrationInputSchema,
  type CapabilityRegistrationInput,
  type CapabilityRegistrationOutput
} from '../rpc/capabilities.js';
import {
  extensionRegistrationInputSchema,
  type ExtensionRegistrationInput,
  type ExtensionRegistrationOutput
} from '../rpc/extensions.js';

export const DEFAULT_MODULE_REGISTRATION_REFRESH_MS = 30_000;

const nonEmptyStringSchema = z.string().trim().min(1);

export const moduleRuntimeConfigSchema = z.object({
  capabilities: z.array(capabilityRegistrationInputSchema).default([]),
  databaseUrl: nonEmptyStringSchema,
  extensionRegistrations: z.array(extensionRegistrationInputSchema).default([]),
  gatewayRpcUrl: nonEmptyStringSchema.optional(),
  migrationFolder: nonEmptyStringSchema,
  natsUrl: nonEmptyStringSchema,
  serviceRpcUrl: nonEmptyStringSchema,
  slug: nonEmptyStringSchema,
  tablePrefix: nonEmptyStringSchema
});

export type ModuleRuntimeConfig = z.output<typeof moduleRuntimeConfigSchema>;

export type ModuleRuntimeConfigEnvironment = Record<string, string | undefined>;

export type ModuleRuntimeConfigOverrides = Partial<{
  capabilities: CapabilityRegistrationInput[];
  databaseUrl: string;
  extensionRegistrations: ExtensionRegistrationInput[];
  gatewayRpcUrl: string;
  migrationFolder: string;
  natsUrl: string;
  serviceRpcUrl: string;
  slug: string;
  tablePrefix: string;
}>;

export type ModuleCapabilityRegistrar = {
  registerCapability(input: CapabilityRegistrationInput): Promise<CapabilityRegistrationOutput>;
};

export type ModuleExtensionRegistrar = {
  registerExtension(input: ExtensionRegistrationInput): Promise<ExtensionRegistrationOutput>;
};

export type ModuleStartupHooks<TDatabase, TEventBus, TRpcServer> = {
  connectEventBus?: ((config: ModuleRuntimeConfig) => Promise<TEventBus>) | undefined;
  createDatabaseClient?: ((config: ModuleRuntimeConfig) => Promise<TDatabase>) | undefined;
  registerCapabilities?:
    | ((config: ModuleRuntimeConfig) => Promise<CapabilityRegistrationOutput[]>)
    | undefined;
  registerExtensions?:
    | ((config: ModuleRuntimeConfig) => Promise<ExtensionRegistrationOutput[]>)
    | undefined;
  runHealthCheck?: ((config: ModuleRuntimeConfig) => Promise<void>) | undefined;
  startTrpcServer?: ((config: ModuleRuntimeConfig) => Promise<TRpcServer>) | undefined;
};

export type StartedModuleRuntime<TDatabase, TEventBus, TRpcServer> = {
  databaseClient?: TDatabase | undefined;
  eventBus?: TEventBus | undefined;
  refresh: RegistrationRefreshHandle;
  rpcServer?: TRpcServer | undefined;
};

export type RegistrationRefreshHandle = {
  refresh(): Promise<void>;
  stop(): void;
};

export function loadModuleRuntimeConfig(
  env: ModuleRuntimeConfigEnvironment,
  overrides: ModuleRuntimeConfigOverrides = {}
): ModuleRuntimeConfig {
  const slug = overrides.slug ?? requireEnv(env, 'MODULE_SLUG');

  return moduleRuntimeConfigSchema.parse({
    capabilities: overrides.capabilities ?? [],
    databaseUrl: overrides.databaseUrl ?? requireEnv(env, 'DATABASE_URL'),
    extensionRegistrations: overrides.extensionRegistrations ?? [],
    gatewayRpcUrl: overrides.gatewayRpcUrl ?? env.GATEWAY_RPC_URL,
    migrationFolder:
      overrides.migrationFolder ?? env.MODULE_MIGRATION_FOLDER ?? `packages/${slug}/drizzle`,
    natsUrl: overrides.natsUrl ?? requireEnv(env, 'NATS_URL'),
    serviceRpcUrl: overrides.serviceRpcUrl ?? requireEnv(env, 'MODULE_RPC_URL'),
    slug,
    tablePrefix: overrides.tablePrefix ?? env.MODULE_TABLE_PREFIX ?? `${slug}_`
  });
}

export async function registerModuleCapabilities(
  config: ModuleRuntimeConfig,
  registrar: ModuleCapabilityRegistrar
): Promise<CapabilityRegistrationOutput[]> {
  return Promise.all(config.capabilities.map((input) => registrar.registerCapability(input)));
}

export async function registerModuleExtensions(
  config: ModuleRuntimeConfig,
  registrar: ModuleExtensionRegistrar
): Promise<ExtensionRegistrationOutput[]> {
  return Promise.all(
    config.extensionRegistrations.map((input) => registrar.registerExtension(input))
  );
}

export async function startTrustedModuleRuntime<TDatabase, TEventBus, TRpcServer>(
  config: ModuleRuntimeConfig,
  hooks: ModuleStartupHooks<TDatabase, TEventBus, TRpcServer>,
  refreshOptions: { intervalMs?: number } = {}
): Promise<StartedModuleRuntime<TDatabase, TEventBus, TRpcServer>> {
  await hooks.runHealthCheck?.(config);
  const databaseClient = await hooks.createDatabaseClient?.(config);
  const eventBus = await hooks.connectEventBus?.(config);
  const rpcServer = await hooks.startTrpcServer?.(config);
  const refresh = startRegistrationRefresh({
    ...(refreshOptions.intervalMs === undefined ? {} : { intervalMs: refreshOptions.intervalMs }),
    refresh: async () => {
      await hooks.registerCapabilities?.(config);
      await hooks.registerExtensions?.(config);
    }
  });
  await refresh.refresh();

  return {
    ...(databaseClient === undefined ? {} : { databaseClient }),
    ...(eventBus === undefined ? {} : { eventBus }),
    refresh,
    ...(rpcServer === undefined ? {} : { rpcServer })
  };
}

export function startRegistrationRefresh(options: {
  intervalMs?: number;
  onError?: ((error: unknown) => void) | undefined;
  refresh: () => Promise<void>;
}): RegistrationRefreshHandle {
  const intervalMs = options.intervalMs ?? DEFAULT_MODULE_REGISTRATION_REFRESH_MS;
  const interval = setInterval(() => {
    void options.refresh().catch((error: unknown) => {
      options.onError?.(error);
    });
  }, intervalMs);
  interval.unref();

  return {
    refresh: options.refresh,
    stop(): void {
      clearInterval(interval);
    }
  };
}

function requireEnv(env: ModuleRuntimeConfigEnvironment, name: string): string {
  const value = env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing required module runtime environment variable: ${name}`);
  }

  return value;
}
