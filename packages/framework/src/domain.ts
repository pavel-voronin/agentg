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

export type DomainDefinitionOptions<
  Deps,
  Runtime,
  Procedures extends InternalRpcProcedureMap<Runtime>,
  ControlPlane
> = InternalRpcDomainOptions<Deps, Runtime, Procedures> & {
  controlPlane?(config: DomainControlPlaneConfig): ControlPlane;
  events: readonly string[];
  extensions?: readonly DomainExtension[];
  required?: boolean;
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
  ControlPlane = unknown
>(options: DomainDefinitionOptions<Deps, Runtime, Procedures, ControlPlane>) {
  const rpc = defineInternalRpcDomain(options);

  return {
    createContext: rpc.createContext,
    createRpcClient: rpc.createClient,
    createRpcRouter: rpc.createRouter,
    createServiceManifest(
      config: DomainServiceManifestConfig
    ): DomainServiceManifest<ControlPlane> {
      return {
        ...(options.controlPlane === undefined
          ? {}
          : {
              controlPlane: options.controlPlane({
                assetVersion: config.controlPlaneAssetVersion,
                assetVersions: config.controlPlaneAssetVersions
              })
            }),
        events: [...options.events].sort(),
        extensions: [...(options.extensions ?? [])],
        procedures: rpc.procedures(),
        required: options.required ?? true,
        rpcUrl: config.rpcUrl,
        slug: options.slug
      };
    },
    events: [...options.events].sort(),
    rpcProcedures: () => rpc.procedures(),
    slug: options.slug,
    startRpcServer: (serverOptions: InternalRpcDomainServerOptions<Deps>) =>
      rpc.startServer(serverOptions),
    stopRpcServer: (server: Server) => rpc.stopServer(server)
  };
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
