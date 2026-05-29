import type { Server } from 'node:http';

import type { EventBus } from '@agentg/events/bus';
import type {
  AnyProcedure,
  inferProcedureInput,
  inferProcedureOutput
} from '@trpc/server/unstable-core-do-not-import';

import { internalRpcProcedureOptions, type InternalRpcCallOptions } from './callOptions.js';
import { formatInternalTrpcBindAddress, type InternalTrpcBindConfig } from './config.js';
import {
  callInternalTrpcProcedure,
  createInternalTrpcClient,
  type InternalTrpcClientOptions
} from './client.js';
import type { InternalTrpcClientConfig } from './config.js';
import {
  createInternalTrpcContext,
  createInternalTrpcService,
  type InternalTrpcContext,
  type InternalTrpcContextOptions,
  type InternalTrpcProcedureBuilder
} from './trpc.js';
import { createInternalTrpcHttpServer, type InternalTrpcStaticAssetConfig } from './httpServer.js';

export type InternalRpcProcedureKind = 'mutation' | 'query';

export type InternalRpcProcedureRecord = {
  kind: InternalRpcProcedureKind;
  name: string;
};

export type InternalRpcProcedure<Context, Procedure> = {
  create(context: Context, procedure: InternalTrpcProcedureBuilder): Procedure;
  kind: InternalRpcProcedureKind;
};

type InternalRpcProcedureMap<Context> = Record<string, InternalRpcProcedure<Context, AnyProcedure>>;

type InternalRpcRouterRecord<Context, Procedures extends InternalRpcProcedureMap<Context>> = {
  [Name in keyof Procedures]: ReturnType<Procedures[Name]['create']>;
};

export type InternalRpcDomainOptions<
  Deps,
  Context,
  Procedures extends InternalRpcProcedureMap<Context>
> = {
  createProcedureContext(deps: Deps): Context;
  procedures: Procedures;
  slug: string;
};

export type InternalRpcDomainServerOptions<Deps> = {
  bind: InternalTrpcBindConfig;
  deps: Deps;
  eventBus?: EventBus | undefined;
  readyEvent?: string | undefined;
  staticAssets?: InternalTrpcStaticAssetConfig | InternalTrpcStaticAssetConfig[] | undefined;
};

export type InternalRpcDomainClientOptions = {
  timeoutMessage?: string;
  timeoutMs?: number;
};

type InternalRpcClientProcedure<Procedure extends AnyProcedure> =
  undefined extends inferProcedureInput<Procedure>
    ? (
        input?: inferProcedureInput<Procedure>,
        options?: InternalRpcCallOptions
      ) => Promise<inferProcedureOutput<Procedure>>
    : (
        input: inferProcedureInput<Procedure>,
        options?: InternalRpcCallOptions
      ) => Promise<inferProcedureOutput<Procedure>>;

export type InternalRpcDomainClient<
  Context,
  Procedures extends InternalRpcProcedureMap<Context>
> = {
  close(): void;
} & {
  [Name in keyof Procedures]: InternalRpcClientProcedure<ReturnType<Procedures[Name]['create']>>;
};

export type DomainControlPlaneConfig = {
  assetVersion: string;
  assetVersions: Readonly<Record<string, string>>;
};

export type DomainServiceManifestConfig = {
  controlPlaneAssetVersion: string;
  controlPlaneAssetVersions: Readonly<Record<string, string>>;
  rpcUrl: string;
};

export type DomainExtension = {
  extension: string;
  target: string;
};

export type DomainServiceManifest<ControlPlane> = {
  controlPlane?: ControlPlane | undefined;
  events: string[];
  extensions: DomainExtension[];
  procedures: InternalRpcProcedureRecord[];
  required: boolean;
  rpcUrl: string;
  slug: string;
};

export type Domain<
  Deps,
  Context,
  Procedures extends InternalRpcProcedureMap<Context>,
  ControlPlane,
  RunOptions
> = {
  createContext: ReturnType<
    typeof defineInternalRpcDomain<Deps, Context, Procedures>
  >['createContext'];
  createRpcClient: ReturnType<
    typeof defineInternalRpcDomain<Deps, Context, Procedures>
  >['createClient'];
  createRpcRouter: ReturnType<
    typeof defineInternalRpcDomain<Deps, Context, Procedures>
  >['createRouter'];
  createServiceManifest(config: DomainServiceManifestConfig): DomainServiceManifest<ControlPlane>;
  events: string[];
  rpcProcedures(): InternalRpcProcedureRecord[];
  run(options: RunOptions): Promise<void>;
  slug: string;
  startRpcServer: ReturnType<
    typeof defineInternalRpcDomain<Deps, Context, Procedures>
  >['startServer'];
  stopRpcServer: ReturnType<
    typeof defineInternalRpcDomain<Deps, Context, Procedures>
  >['stopServer'];
};

export const bindSubsystemContext: unique symbol = Symbol('agentg.bindSubsystemContext');

export type Subsystem<RunOptions, Context> = {
  [bindSubsystemContext]?(context: unknown): void;
  init?(): void;
  start(options: RunOptions, domain: Context): Promise<void>;
};

export type UseSubsystem<TSubsystem extends Subsystem<unknown, unknown>> = () => TSubsystem;

export type ResourceSubsystem<TResource extends object, RunOptions, Context> = TResource &
  Subsystem<RunOptions, Context> & {
    configure(resource: TResource): void;
  };

export type ControlPlaneSubsystem<ControlPlane, Context = unknown> = {
  createControlPlane(config: DomainControlPlaneConfig): ControlPlane;
  createProcedureRouter?(): DomainProcedureRouter<Context>;
};

type ControlPlaneSubsystemWithProcedures<
  ControlPlane,
  Context,
  Router extends DomainProcedureRouter<Context>
> = ControlPlaneSubsystem<ControlPlane, Context> & {
  createProcedureRouter(): Router;
};

type DomainProcedureSource<Context> =
  | InternalRpcProcedure<Context, AnyProcedure>
  | DomainProcedureRouter<Context>;

type DomainProcedureSources<Context> = Record<string, DomainProcedureSource<Context>>;

export type PrefixedProcedureMap<Prefix extends string, Procedures> = {
  [Name in keyof Procedures as `${Prefix}.${Name & string}`]: Procedures[Name];
};

export type DomainProcedureRouter<
  Context,
  Procedures extends InternalRpcProcedureMap<Context> = InternalRpcProcedureMap<Context>
> = {
  kind: 'procedureRouter';
  name: string;
  procedures: Procedures;
};

type DomainProcedureRouterBuilder<Context> = DomainProcedureRouter<Context> & {
  defineProcedures(procedures: InternalRpcProcedureMap<Context>): void;
};

type DomainSetupState = {
  controlPlane?: ControlPlaneSubsystem<unknown> | undefined;
  createdSubsystemsByName: Record<string, Subsystem<unknown, unknown>>;
  events: Set<string>;
  extensions: DomainExtension[];
  procedures: Record<string, InternalRpcProcedure<unknown, AnyProcedure>>;
  required: boolean;
  slug: string;
  subsystems: {
    name: string;
    subsystem: Subsystem<unknown, unknown>;
  }[];
  subsystemsByName: Record<string, Subsystem<unknown, unknown>>;
};

type InternalTrpcClientProcedure = {
  mutate(
    input: unknown,
    options: { context?: InternalRpcCallOptions; signal?: AbortSignal }
  ): Promise<unknown>;
  query(
    input: unknown,
    options: { context?: InternalRpcCallOptions; signal?: AbortSignal }
  ): Promise<unknown>;
};

type ProcedureFactory<Procedure> = (procedure: InternalTrpcProcedureBuilder) => Procedure;

export function query<Procedure>(
  create: ProcedureFactory<Procedure>
): InternalRpcProcedure<unknown, Procedure> {
  return {
    create: (_ignored, procedure) => create(procedure),
    kind: 'query'
  };
}

export function mutation<Procedure>(
  create: ProcedureFactory<Procedure>
): InternalRpcProcedure<unknown, Procedure> {
  return {
    create: (_ignored, procedure) => create(procedure),
    kind: 'mutation'
  };
}

export function defineInternalRpcDomain<
  Deps,
  Context,
  const Procedures extends InternalRpcProcedureMap<Context>
>(options: InternalRpcDomainOptions<Deps, Context, Procedures>) {
  const service = createInternalTrpcService(options.slug);

  function createRouter(deps: Deps) {
    const context = options.createProcedureContext(deps);
    return service.router(
      Object.fromEntries(
        Object.entries(options.procedures).map(([name, procedure]) => [
          name,
          procedure.create(context, service.procedure)
        ])
      ) as InternalRpcRouterRecord<Context, Procedures>
    );
  }

  async function startServer(serverOptions: InternalRpcDomainServerOptions<Deps>): Promise<Server> {
    const httpServerOptions = {
      createContext: (contextOptions: Parameters<typeof createInternalTrpcContext>[0]) =>
        createInternalTrpcContext(contextOptions, {
          eventBus: serverOptions.eventBus
        }),
      router: createRouter(serverOptions.deps),
      ...(serverOptions.staticAssets === undefined
        ? {}
        : { staticAssets: serverOptions.staticAssets })
    } as unknown as Parameters<
      typeof createInternalTrpcHttpServer<ReturnType<typeof createRouter>>
    >[0];
    const server = createInternalTrpcHttpServer(httpServerOptions);
    const address = formatInternalTrpcBindAddress(serverOptions.bind);

    await listen(server, serverOptions.bind.host, serverOptions.bind.port);

    console.log(
      JSON.stringify({
        address,
        event: serverOptions.readyEvent ?? `${options.slug}.trpc.ready`
      })
    );
    return server;
  }

  function createClient(
    config: InternalTrpcClientConfig,
    clientOptions: InternalRpcDomainClientOptions = {}
  ): InternalRpcDomainClient<Context, Procedures> {
    const client = createInternalTrpcClient<ReturnType<typeof createRouter>>(config);
    const procedures = Object.fromEntries(
      Object.entries(options.procedures).map(([name, procedure]) => [
        name,
        (input: unknown, callOptions?: InternalRpcCallOptions) =>
          callInternalRpcDomainProcedure({
            callOptions,
            client,
            input,
            kind: procedure.kind,
            name,
            options: clientTimeoutOptions(options.slug, clientOptions)
          })
      ])
    );

    return {
      close() {
        return;
      },
      ...procedures
    } as InternalRpcDomainClient<Context, Procedures>;
  }

  return {
    createContext: (
      contextOptions: Parameters<typeof createInternalTrpcContext>[0],
      options?: InternalTrpcContextOptions
    ): InternalTrpcContext => createInternalTrpcContext(contextOptions, options),
    createRouter,
    createClient,
    procedures(): InternalRpcProcedureRecord[] {
      return Object.entries(options.procedures).map(([name, procedure]) => ({
        kind: procedure.kind,
        name: `${options.slug}.${name}`
      }));
    },
    startServer,
    stopServer
  };
}

export function defineDomain<
  Deps,
  Context,
  const Procedures extends InternalRpcProcedureMap<Context>,
  ControlPlane,
  RunOptions
>(slug: string, setup: () => void): Domain<Deps, Context, Procedures, ControlPlane, RunOptions> {
  const previousState = currentDomainState;
  const state: DomainSetupState = {
    createdSubsystemsByName: {},
    events: new Set(),
    extensions: [],
    procedures: {},
    required: true,
    slug,
    subsystems: [],
    subsystemsByName: {}
  };
  currentDomainState = state;
  try {
    setup();
  } finally {
    currentDomainState = previousState;
  }

  const rpc = defineInternalRpcDomain<Deps, Context, Procedures>({
    createProcedureContext: createDomainProcedureContext(slug, state) as (deps: Deps) => Context,
    procedures: state.procedures as Procedures,
    slug
  });
  const events = [...state.events].sort();

  const domain = {
    createContext: rpc.createContext,
    createRpcClient: rpc.createClient,
    createRpcRouter: rpc.createRouter,
    createServiceManifest(
      config: DomainServiceManifestConfig
    ): DomainServiceManifest<ControlPlane> {
      return {
        ...(state.controlPlane === undefined
          ? {}
          : {
              controlPlane: state.controlPlane.createControlPlane({
                assetVersion: config.controlPlaneAssetVersion,
                assetVersions: config.controlPlaneAssetVersions
              }) as ControlPlane
            }),
        events,
        extensions: state.extensions,
        procedures: rpc.procedures(),
        required: state.required,
        rpcUrl: config.rpcUrl,
        slug
      };
    },
    events,
    rpcProcedures: () => rpc.procedures(),
    slug,
    startRpcServer: (serverOptions: InternalRpcDomainServerOptions<Deps>) =>
      rpc.startServer(serverOptions),
    stopRpcServer: (server: Server) => rpc.stopServer(server),
    async run(options: RunOptions): Promise<void> {
      if (state.subsystems.length === 0) {
        throw new Error(`Domain ${slug} has no subsystem runner`);
      }

      await Promise.all(state.subsystems.map(({ subsystem }) => subsystem.start(options, domain)));
    }
  } satisfies Domain<Deps, Context, Procedures, ControlPlane, RunOptions>;

  return domain;
}

let currentDomainState: DomainSetupState | undefined;
const subsystemNames = new WeakMap<Subsystem<unknown, unknown>, string>();

export function createRouter<Context = unknown>(
  name: string
): DomainProcedureRouterBuilder<Context> {
  const router: DomainProcedureRouterBuilder<Context> = {
    defineProcedures(procedures) {
      router.procedures = prefixProcedures(name, procedures);
    },
    kind: 'procedureRouter',
    name,
    procedures: {}
  };
  return router;
}

export function createProcedureRouter<
  Context,
  const Name extends string,
  const Procedures extends InternalRpcProcedureMap<Context>
>(
  name: Name,
  procedures: Procedures
): DomainProcedureRouter<Context, PrefixedProcedureMap<Name, Procedures>> {
  return {
    kind: 'procedureRouter',
    name,
    procedures: prefixProcedures(name, procedures) as PrefixedProcedureMap<Name, Procedures>
  };
}

export function defineControlPlane<
  ControlPlane,
  Context,
  Router extends DomainProcedureRouter<Context>
>(
  controlPlane: ControlPlaneSubsystemWithProcedures<ControlPlane, Context, Router>
): { procedures: Router };
export function defineControlPlane<ControlPlane>(
  controlPlane: ControlPlaneSubsystem<ControlPlane>
): Record<string, never>;
export function defineControlPlane<ControlPlane, Context>(
  controlPlane: ControlPlaneSubsystem<ControlPlane, Context>
): { procedures: DomainProcedureRouter<Context> } | Record<string, never> {
  activeDomainState().controlPlane = controlPlane;
  const controlPlaneProcedures = controlPlane.createProcedureRouter?.();
  return controlPlaneProcedures === undefined ? {} : { procedures: controlPlaneProcedures };
}

export function defineEvent(event: string): void {
  activeDomainState().events.add(event);
}

export function defineEvents(events: readonly string[]): void {
  for (const event of events) {
    defineEvent(event);
  }
}

export function defineExtensions(extensions: readonly DomainExtension[]): void {
  activeDomainState().extensions.push(...extensions);
}

export function defineProcedures<Context>(procedures: DomainProcedureSources<Context>): void {
  const state = activeDomainState();
  for (const [name, procedure] of Object.entries(procedures)) {
    if (isDomainProcedureRouter(procedure)) {
      Object.assign(state.procedures, procedure.procedures);
      continue;
    }
    state.procedures[name] = procedure;
  }
}

export function defineSubsystem<
  TSubsystem extends Subsystem<RunOptions, Context>,
  RunOptions,
  Context
>(name: string, setup: () => TSubsystem): UseSubsystem<TSubsystem> {
  let subsystem: TSubsystem | undefined;

  return () => {
    if (subsystem !== undefined) {
      return subsystem;
    }

    const state = activeDomainState();
    const registered = state.subsystemsByName[name];
    if (registered !== undefined) {
      subsystem = registered as TSubsystem;
      return subsystem;
    }

    const created = state.createdSubsystemsByName[name];
    if (created !== undefined) {
      subsystem = created as TSubsystem;
      return subsystem;
    }

    subsystem = setup();
    subsystem.init?.();
    subsystemNames.set(subsystem, name);
    state.createdSubsystemsByName[name] = subsystem;
    return subsystem;
  };
}

export function defineResourceSubsystem<TResource extends object, RunOptions, Context>(
  name: string,
  resolve: {
    fromContext?(context: unknown): TResource | undefined;
    fromRun?(options: RunOptions, domain: Context): TResource | undefined;
  }
): UseSubsystem<ResourceSubsystem<TResource, RunOptions, Context>> {
  let resource: TResource | undefined;

  function configure(nextResource: TResource | undefined): void {
    if (nextResource !== undefined) {
      resource = nextResource;
    }
  }

  function readyResource(): TResource {
    if (resource === undefined) {
      throw new Error(`Subsystem ${name} resource is not ready`);
    }
    return resource;
  }

  return defineSubsystem(name, () => {
    const lifecycle: Subsystem<RunOptions, Context> & {
      configure(resource: TResource): void;
    } = {
      [bindSubsystemContext](context: unknown): void {
        configure(resolve.fromContext?.(context));
      },
      configure(resource: TResource): void {
        configure(resource);
      },
      init(): void {
        configure(undefined);
      },
      start(options: RunOptions, domain: Context): Promise<void> {
        configure(resolve.fromRun?.(options, domain));
        return Promise.resolve();
      }
    };

    return new Proxy(lifecycle, {
      get(target, property) {
        if (property in target) {
          return (target as Record<PropertyKey, unknown>)[property];
        }

        const resource = readyResource();
        const value = (resource as Record<PropertyKey, unknown>)[property];
        if (typeof value !== 'function') {
          return value;
        }

        return value.bind(resource) as (...args: unknown[]) => unknown;
      },
      set(_target, property, value) {
        (readyResource() as Record<PropertyKey, unknown>)[property] = value;
        return true;
      }
    }) as ResourceSubsystem<TResource, RunOptions, Context>;
  });
}

export function registerSubsystem<TSubsystem extends Subsystem<unknown, unknown>>(
  subsystem: TSubsystem
): TSubsystem {
  const state = activeDomainState();
  const name = subsystemNames.get(subsystem);
  if (name === undefined) {
    throw new Error('Subsystem must be created through defineSubsystem before registration');
  }

  const existing = state.subsystemsByName[name];
  if (existing === subsystem) {
    return existing as TSubsystem;
  }
  if (existing !== undefined) {
    throw new Error(`Subsystem ${name} is already registered`);
  }

  state.subsystems.push({
    name,
    subsystem
  });
  state.subsystemsByName[name] = subsystem;
  return subsystem;
}

export function setRequired(required: boolean): void {
  activeDomainState().required = required;
}

function activeDomainState(): DomainSetupState {
  if (currentDomainState === undefined) {
    throw new Error('Domain composition function called outside defineDomain setup');
  }

  return currentDomainState;
}

function isDomainProcedureRouter<Context>(
  procedure: DomainProcedureSource<Context>
): procedure is DomainProcedureRouter<Context> {
  return 'kind' in procedure && procedure.kind === 'procedureRouter';
}

function prefixProcedures<Context>(
  prefix: string,
  procedures: InternalRpcProcedureMap<Context>
): InternalRpcProcedureMap<Context> {
  return Object.fromEntries(
    Object.entries(procedures).map(([name, procedure]) => [
      name.startsWith(`${prefix}.`) ? name : `${prefix}.${name}`,
      procedure
    ])
  );
}

function createDomainProcedureContext(
  slug: string,
  state: DomainSetupState
): (deps: unknown) => unknown {
  return (deps) => {
    if (!isObjectRecord(deps)) {
      throw new Error(`Domain ${slug} deps must be an object`);
    }

    const context = { ...deps };
    for (const { subsystem } of state.subsystems) {
      subsystem[bindSubsystemContext]?.(context);
    }
    return context;
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function callInternalRpcDomainProcedure(options: {
  callOptions: InternalRpcCallOptions | undefined;
  client: unknown;
  input: unknown;
  kind: InternalRpcProcedureKind;
  name: string;
  options: InternalTrpcClientOptions;
}): Promise<unknown> {
  const procedure = (options.client as Record<string, InternalTrpcClientProcedure>)[options.name];
  if (procedure === undefined) {
    throw new Error(`Internal RPC client missing procedure ${options.name}`);
  }

  return callInternalTrpcProcedure(
    (signal) =>
      options.kind === 'query'
        ? procedure.query(options.input, internalRpcProcedureOptions(options.callOptions, signal))
        : procedure.mutate(options.input, internalRpcProcedureOptions(options.callOptions, signal)),
    options.options
  );
}

function clientTimeoutOptions(
  slug: string,
  options: InternalRpcDomainClientOptions
): InternalTrpcClientOptions {
  return {
    timeoutMessage: options.timeoutMessage ?? `${titleCaseSlug(slug)} tRPC timed out`,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs })
  };
}

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve) => {
    server.listen(port, host, resolve);
  });
}

export function stopServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
