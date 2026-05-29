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
  type InternalTrpcContextRuntime,
  type InternalTrpcProcedureBuilder
} from './trpc.js';
import { createInternalTrpcHttpServer, type InternalTrpcStaticAssetConfig } from './httpServer.js';

export type InternalRpcProcedureKind = 'mutation' | 'query';

export type InternalRpcProcedureRecord = {
  kind: InternalRpcProcedureKind;
  name: string;
};

export type InternalRpcProcedure<Runtime, Procedure> = {
  create(runtime: Runtime, procedure: InternalTrpcProcedureBuilder): Procedure;
  kind: InternalRpcProcedureKind;
};

type InternalRpcProcedureMap<Runtime> = Record<string, InternalRpcProcedure<Runtime, AnyProcedure>>;

type InternalRpcRouterRecord<Runtime, Procedures extends InternalRpcProcedureMap<Runtime>> = {
  [Name in keyof Procedures]: ReturnType<Procedures[Name]['create']>;
};

export type InternalRpcDomainOptions<
  Deps,
  Runtime,
  Procedures extends InternalRpcProcedureMap<Runtime>
> = {
  createRuntime(deps: Deps): Runtime;
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
  Runtime,
  Procedures extends InternalRpcProcedureMap<Runtime>
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
  Runtime,
  Procedures extends InternalRpcProcedureMap<Runtime>,
  ControlPlane,
  RunOptions
> = {
  createContext: ReturnType<
    typeof defineInternalRpcDomain<Deps, Runtime, Procedures>
  >['createContext'];
  createRpcClient: ReturnType<
    typeof defineInternalRpcDomain<Deps, Runtime, Procedures>
  >['createClient'];
  createRpcRouter: ReturnType<
    typeof defineInternalRpcDomain<Deps, Runtime, Procedures>
  >['createRouter'];
  createServiceManifest(config: DomainServiceManifestConfig): DomainServiceManifest<ControlPlane>;
  events: string[];
  rpcProcedures(): InternalRpcProcedureRecord[];
  run(options: RunOptions): Promise<void>;
  slug: string;
  startRpcServer: ReturnType<
    typeof defineInternalRpcDomain<Deps, Runtime, Procedures>
  >['startServer'];
  stopRpcServer: ReturnType<
    typeof defineInternalRpcDomain<Deps, Runtime, Procedures>
  >['stopServer'];
};

export type Subsystem<RunOptions, Context> = {
  init?(): void;
  start(options: RunOptions, domain: Context): Promise<void>;
};

export type ControlPlaneSubsystem<ControlPlane, Runtime = unknown> = {
  createControlPlane(config: DomainControlPlaneConfig): ControlPlane;
  createProcedureRouter?(): DomainProcedureRouter<Runtime>;
};

type ControlPlaneSubsystemWithProcedures<
  ControlPlane,
  Runtime,
  Router extends DomainProcedureRouter<Runtime>
> = ControlPlaneSubsystem<ControlPlane, Runtime> & {
  createProcedureRouter(): Router;
};

type DomainProcedureSource<Runtime> =
  | InternalRpcProcedure<Runtime, AnyProcedure>
  | DomainProcedureRouter<Runtime>;

type DomainProcedureSources<Runtime> = Record<string, DomainProcedureSource<Runtime>>;

export type PrefixedProcedureMap<Prefix extends string, Procedures> = {
  [Name in keyof Procedures as `${Prefix}.${Name & string}`]: Procedures[Name];
};

export type DomainProcedureRouter<
  Runtime,
  Procedures extends InternalRpcProcedureMap<Runtime> = InternalRpcProcedureMap<Runtime>
> = {
  kind: 'procedureRouter';
  name: string;
  procedures: Procedures;
};

type DomainProcedureRouterBuilder<Runtime> = DomainProcedureRouter<Runtime> & {
  defineProcedures(procedures: InternalRpcProcedureMap<Runtime>): void;
};

type DomainSetupState = {
  controlPlane?: ControlPlaneSubsystem<unknown> | undefined;
  createRuntime?: ((deps: unknown) => unknown) | undefined;
  events: Set<string>;
  extensions: DomainExtension[];
  procedures: Record<string, InternalRpcProcedure<unknown, AnyProcedure>>;
  required: boolean;
  slug: string;
  subsystems: {
    name: string;
    subsystem: Subsystem<unknown, unknown>;
  }[];
};

type DomainRuntimeFactory<Deps, Runtime> = (deps: Deps) => Runtime;

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

export function query<Runtime, Procedure>(
  create: (runtime: Runtime, procedure: InternalTrpcProcedureBuilder) => Procedure
): InternalRpcProcedure<Runtime, Procedure> {
  return {
    create,
    kind: 'query'
  };
}

export function mutation<Runtime, Procedure>(
  create: (runtime: Runtime, procedure: InternalTrpcProcedureBuilder) => Procedure
): InternalRpcProcedure<Runtime, Procedure> {
  return {
    create,
    kind: 'mutation'
  };
}

export function defineInternalRpcDomain<
  Deps,
  Runtime,
  const Procedures extends InternalRpcProcedureMap<Runtime>
>(options: InternalRpcDomainOptions<Deps, Runtime, Procedures>) {
  const service = createInternalTrpcService(options.slug);

  function createRouter(deps: Deps) {
    const runtime = options.createRuntime(deps);
    return service.router(
      Object.fromEntries(
        Object.entries(options.procedures).map(([name, procedure]) => [
          name,
          procedure.create(runtime, service.procedure)
        ])
      ) as InternalRpcRouterRecord<Runtime, Procedures>
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
  ): InternalRpcDomainClient<Runtime, Procedures> {
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
    } as InternalRpcDomainClient<Runtime, Procedures>;
  }

  return {
    createContext: (
      contextOptions: Parameters<typeof createInternalTrpcContext>[0],
      runtime?: InternalTrpcContextRuntime
    ): InternalTrpcContext => createInternalTrpcContext(contextOptions, runtime),
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
  Runtime,
  const Procedures extends InternalRpcProcedureMap<Runtime>,
  ControlPlane,
  RunOptions
>(slug: string, setup: () => void): Domain<Deps, Runtime, Procedures, ControlPlane, RunOptions> {
  const previousState = currentDomainState;
  const state: DomainSetupState = {
    events: new Set(),
    extensions: [],
    procedures: {},
    required: true,
    slug,
    subsystems: []
  };
  currentDomainState = state;
  try {
    setup();
  } finally {
    currentDomainState = previousState;
  }

  if (state.createRuntime === undefined) {
    throw new Error(`Domain ${slug} must define runtime`);
  }

  const rpc = defineInternalRpcDomain<Deps, Runtime, Procedures>({
    createRuntime: state.createRuntime as (deps: Deps) => Runtime,
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
  } satisfies Domain<Deps, Runtime, Procedures, ControlPlane, RunOptions>;

  return domain;
}

let currentDomainState: DomainSetupState | undefined;

export function createRouter<Runtime = unknown>(
  name: string
): DomainProcedureRouterBuilder<Runtime> {
  const router: DomainProcedureRouterBuilder<Runtime> = {
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
  Runtime,
  const Name extends string,
  const Procedures extends InternalRpcProcedureMap<Runtime>
>(
  name: Name,
  procedures: Procedures
): DomainProcedureRouter<Runtime, PrefixedProcedureMap<Name, Procedures>> {
  return {
    kind: 'procedureRouter',
    name,
    procedures: prefixProcedures(name, procedures) as PrefixedProcedureMap<Name, Procedures>
  };
}

export function defineControlPlane<
  ControlPlane,
  Runtime,
  Router extends DomainProcedureRouter<Runtime>
>(
  controlPlane: ControlPlaneSubsystemWithProcedures<ControlPlane, Runtime, Router>
): { procedures: Router };
export function defineControlPlane<ControlPlane>(
  controlPlane: ControlPlaneSubsystem<ControlPlane>
): Record<string, never>;
export function defineControlPlane<ControlPlane, Runtime>(
  controlPlane: ControlPlaneSubsystem<ControlPlane, Runtime>
): { procedures: DomainProcedureRouter<Runtime> } | Record<string, never> {
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

export function defineProcedures<Runtime>(procedures: DomainProcedureSources<Runtime>): void {
  const state = activeDomainState();
  for (const [name, procedure] of Object.entries(procedures)) {
    if (isDomainProcedureRouter(procedure)) {
      Object.assign(state.procedures, procedure.procedures);
      continue;
    }
    state.procedures[name] = procedure;
  }
}

export function defineRuntime<Deps, Runtime>(
  createRuntime: DomainRuntimeFactory<Deps, Runtime>
): void {
  activeDomainState().createRuntime = createRuntime as (deps: unknown) => unknown;
}

export function defineSubsystem<RunOptions, Context>(
  name: string,
  subsystem: Subsystem<RunOptions, Context>
): void {
  subsystem.init?.();
  activeDomainState().subsystems.push({
    name,
    subsystem
  });
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

function isDomainProcedureRouter<Runtime>(
  procedure: DomainProcedureSource<Runtime>
): procedure is DomainProcedureRouter<Runtime> {
  return 'kind' in procedure && procedure.kind === 'procedureRouter';
}

function prefixProcedures<Runtime>(
  prefix: string,
  procedures: InternalRpcProcedureMap<Runtime>
): InternalRpcProcedureMap<Runtime> {
  return Object.fromEntries(
    Object.entries(procedures).map(([name, procedure]) => [
      name.startsWith(`${prefix}.`) ? name : `${prefix}.${name}`,
      procedure
    ])
  );
}

export function runtimeForInternalRpcCall<Runtime extends { eventBus: EventBus }>(
  runtime: Runtime,
  ctx: InternalTrpcContext
): Runtime {
  if (ctx.eventBus === undefined || ctx.eventBus === runtime.eventBus) {
    return runtime;
  }

  return {
    ...runtime,
    eventBus: ctx.eventBus
  };
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
