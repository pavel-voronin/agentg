import type { EventBus, EventBusFactory } from './events/eventBus.js';
import { callProcedure } from './rpc/httpRpc.js';
import type { ProcedureServer, RpcFactory } from './rpc/rpc.js';
import { moduleByName } from './registry/client.js';
import type { RegistryConnection, RegistryConnector } from './registry/connector.js';
import type { ExtensionInput, ModuleManifest } from './registry/contracts.js';
import type { MaybePromise, ProcedureMap } from './types.js';

type StopProcess = () => MaybePromise<undefined>;

type ProcessStartResult = undefined | StopProcess | { stop?: StopProcess | undefined };

type ModuleSurface<TProcedures extends ProcedureMap = ProcedureMap> = {
  readonly extensions?: readonly ExtensionInput[] | undefined;
  readonly procedures?: TProcedures | undefined;
  readonly required?: boolean | undefined;
};

type ModuleProcedures<TSurface> = TSurface extends {
  readonly procedures?: infer TProcedures | undefined;
}
  ? TProcedures extends ProcedureMap
    ? TProcedures
    : ProcedureMap
  : ProcedureMap;

type ProcedureOwner = {
  readonly procedures: ProcedureMap;
};

export type ProceduresOf<TModule> = TModule extends (...args: never[]) => infer TApp
  ? TApp extends ProcedureOwner
    ? TApp['procedures']
    : never
  : TModule extends ProcedureOwner
    ? TModule['procedures']
    : never;

type RpcMethod<TProcedure> = TProcedure extends () => infer TOutput
  ? () => Promise<Awaited<TOutput>>
  : TProcedure extends (input: infer TInput) => infer TOutput
    ? (input: TInput) => Promise<Awaited<TOutput>>
    : never;

type RpcClient<TProcedures extends ProcedureMap> = {
  readonly [TName in keyof TProcedures]: RpcMethod<TProcedures[TName]>;
};

type ModuleProcess = {
  name: string;
  start(): MaybePromise<ProcessStartResult>;
};

type ResourceBackground = {
  (start: ModuleProcess['start']): void;
  (name: string, start: ModuleProcess['start']): void;
};

type ResourceSetup = {
  background: ResourceBackground;
  shutdown: (stop: StopProcess) => void;
  startup: (start: ModuleProcess['start']) => void;
};

type RunningProcess = {
  name: string;
  stop: StopProcess;
};

export type ModuleApp<TProcedures extends ProcedureMap = ProcedureMap> = {
  readonly procedures: TProcedures;
  start(): Promise<void>;
  stop(): Promise<void>;
};

export type ModuleCreateOptions<TConfig> = {
  config: TConfig;
  connect: ModuleConnect;
};

export type ModuleConnect = {
  events: EventBusFactory;
  rpc: RpcFactory;
  registry: RegistryConnector;
};

export type ModuleDefinition<
  TConfig = unknown,
  TProcedures extends ProcedureMap = ProcedureMap
> = ((options: ModuleCreateOptions<TConfig>) => ModuleApp<TProcedures>) & {
  readonly config: ModuleConfigReader<TConfig>;
};

export type ModuleConfigReader<TConfig> = (...sources: never[]) => TConfig;

type ModuleDefinitionInput<TConfig, TSurface extends ModuleSurface> = {
  readonly config: ModuleConfigReader<TConfig>;
  readonly setup: (module: ModuleSetup<TConfig>) => TSurface;
};

type ModuleSetup<TConfig = unknown> = {
  readonly config: TConfig;
  readonly events: EventBus;
  background: (name: string, start: ModuleProcess['start']) => void;
  resource: <T>(name: string, create: (resource: ResourceSetup) => T) => T;
  rpc: <TProcedures extends ProcedureMap>(moduleName: string) => RpcClient<TProcedures>;
  startup: (name: string, start: ModuleProcess['start']) => void;
};

export function defineModule<TConfig, TSurface extends ModuleSurface>(
  name: string,
  input: ModuleDefinitionInput<TConfig, TSurface>
): ModuleDefinition<TConfig, ModuleProcedures<TSurface>> {
  const definition = (options: ModuleCreateOptions<TConfig>) =>
    createModuleApp<TConfig, TSurface>(name, input.setup, options);

  return Object.assign(definition, {
    config: input.config
  });
}

function createModuleApp<TConfig, TSurface extends ModuleSurface>(
  name: string,
  setup: (module: ModuleSetup<TConfig>) => TSurface,
  options: ModuleCreateOptions<TConfig>
): ModuleApp<ModuleProcedures<TSurface>> {
  const backgroundProcesses: ModuleProcess[] = [];
  const procedures: ProcedureMap = {};
  const resources = new Map<string, unknown>();
  const startupProcesses: ModuleProcess[] = [];
  const events = options.connect.events();
  let extensions: readonly ExtensionInput[] = [];
  let required = false;
  let running = false;
  let runningBackgroundProcesses: RunningProcess[] = [];
  let runningProcedureServer: ProcedureServer | undefined;
  let runningStartupProcesses: RunningProcess[] = [];
  let registryConnection: RegistryConnection | undefined;

  const moduleSetup: ModuleSetup<TConfig> = {
    config: options.config,
    events,
    background(backgroundName, start) {
      pushProcess(backgroundProcesses, backgroundName, start);
    },
    resource(resourceName, create) {
      if (resources.has(resourceName)) {
        throw new Error(`Module ${name} already has resource ${resourceName}`);
      }
      const resourceBackgroundProcesses: ModuleProcess[] = [];
      const resourceShutdownProcesses: StopProcess[] = [];
      const resourceStartupProcesses: ModuleProcess['start'][] = [];
      function background(start: ModuleProcess['start']): void;
      function background(backgroundName: string, start: ModuleProcess['start']): void;
      function background(
        first: string | ModuleProcess['start'],
        second?: ModuleProcess['start']
      ): void {
        const processName = typeof first === 'string' ? `${resourceName}.${first}` : resourceName;
        const start = typeof first === 'string' ? second : first;
        if (start === undefined) {
          throw new Error(`Module ${name} resource ${resourceName} has invalid background`);
        }
        pushProcess(resourceBackgroundProcesses, processName, start);
      }
      const resourceSetup: ResourceSetup = {
        background,
        shutdown(stop) {
          resourceShutdownProcesses.push(stop);
        },
        startup(start) {
          resourceStartupProcesses.push(start);
        }
      };
      const resource = create(resourceSetup);
      resources.set(resourceName, resource);
      if (resourceStartupProcesses.length > 0 || resourceShutdownProcesses.length > 0) {
        pushProcess(startupProcesses, resourceName, () =>
          startResource(resourceStartupProcesses, resourceShutdownProcesses)
        );
      }
      backgroundProcesses.push(...resourceBackgroundProcesses);
      return resource;
    },
    rpc(moduleName) {
      return createRpcClient(moduleName, () => registryConnection);
    },
    startup(startupName, start) {
      pushProcess(startupProcesses, startupName, start);
    }
  };

  const surface = setup(moduleSetup);
  const namedBackgroundProcesses = namedProcesses(backgroundProcesses);
  const namedStartupProcesses = namedProcesses(startupProcesses);
  if (surface.extensions !== undefined) {
    extensions = surface.extensions;
  }
  if (surface.procedures !== undefined) {
    for (const [procedureName, procedure] of Object.entries(surface.procedures)) {
      procedures[procedureName] = procedure;
    }
  }
  required = surface.required ?? false;

  return {
    procedures: procedures as ModuleProcedures<TSurface>,
    async start() {
      if (running) {
        return;
      }

      const startedBackground: RunningProcess[] = [];
      const startedStartup: RunningProcess[] = [];
      let procedureServer: ProcedureServer | undefined;
      let activeRegistryConnection: RegistryConnection | undefined;
      try {
        await events.start();
        for (const moduleProcess of namedStartupProcesses) {
          const stop = normalizeProcessStop(await moduleProcess.start());
          startedStartup.push({ name: moduleProcess.name, stop });
        }
        runningStartupProcesses = startedStartup;
        procedureServer = await options.connect.rpc.start(procedures);
        runningProcedureServer = procedureServer;
        activeRegistryConnection = await options.connect.registry.connect({
          events,
          manifest: manifest(name, procedureServer.url, procedures, {
            extensions,
            required
          })
        });
        registryConnection = activeRegistryConnection;
        for (const moduleProcess of namedBackgroundProcesses) {
          const stop = normalizeProcessStop(await moduleProcess.start());
          startedBackground.push({ name: moduleProcess.name, stop });
        }
        runningBackgroundProcesses = startedBackground;
        running = true;
      } catch (error) {
        await stopProcesses(startedBackground);
        activeRegistryConnection?.close();
        if (procedureServer !== undefined) {
          await procedureServer.stop();
        }
        await stopProcesses(startedStartup);
        await events.stop();
        runningBackgroundProcesses = [];
        runningStartupProcesses = [];
        runningProcedureServer = undefined;
        running = false;
        registryConnection = undefined;
        throw error;
      }
    },
    async stop() {
      if (!running) {
        return;
      }
      running = false;
      const backgroundToStop = runningBackgroundProcesses;
      runningBackgroundProcesses = [];
      await stopProcesses(backgroundToStop);
      registryConnection?.close();
      registryConnection = undefined;
      const procedureServer = runningProcedureServer;
      runningProcedureServer = undefined;
      if (procedureServer !== undefined) {
        await procedureServer.stop();
      }
      const startupToStop = runningStartupProcesses;
      runningStartupProcesses = [];
      await stopProcesses(startupToStop);
      await events.stop();
    }
  };
}

function manifest(
  moduleName: string,
  rpcUrl: string,
  procedures: ProcedureMap,
  input: {
    extensions: readonly ExtensionInput[];
    required: boolean;
  }
): ModuleManifest {
  return {
    extensions: input.extensions,
    module: moduleName,
    procedures: Object.keys(procedures),
    required: input.required,
    rpcUrl
  };
}

function normalizeProcessStop(result: ProcessStartResult): StopProcess {
  if (typeof result === 'function') {
    return result;
  }
  if (result?.stop !== undefined) {
    return result.stop;
  }
  return () => undefined;
}

async function startResource(
  startupProcesses: readonly ModuleProcess['start'][],
  shutdownProcesses: readonly StopProcess[]
): Promise<StopProcess> {
  const startupStops: StopProcess[] = [];
  try {
    for (const start of startupProcesses) {
      startupStops.push(normalizeProcessStop(await start()));
    }
  } catch (error) {
    await stopCallbacks(startupStops);
    await stopCallbacks(shutdownProcesses);
    throw error;
  }

  return async () => {
    await stopCallbacks(startupStops);
    await stopCallbacks(shutdownProcesses);
    return undefined;
  };
}

async function stopProcesses(processes: readonly RunningProcess[]): Promise<void> {
  for (const moduleProcess of [...processes].reverse()) {
    await moduleProcess.stop();
  }
}

async function stopCallbacks(callbacks: readonly StopProcess[]): Promise<void> {
  for (const stop of [...callbacks].reverse()) {
    await stop();
  }
}

function pushProcess(
  processes: ModuleProcess[],
  processName: string,
  start: ModuleProcess['start']
): void {
  processes.push({ name: processName, start });
}

function namedProcesses(processes: readonly ModuleProcess[]): ModuleProcess[] {
  const counts = new Map<string, number>();
  const reservedNames = new Set<string>();
  const nextIndexes = new Map<string, number>();

  for (const moduleProcess of processes) {
    counts.set(moduleProcess.name, (counts.get(moduleProcess.name) ?? 0) + 1);
  }
  for (const moduleProcess of processes) {
    if ((counts.get(moduleProcess.name) ?? 0) === 1) {
      reservedNames.add(moduleProcess.name);
    }
  }

  return processes.map((moduleProcess) => {
    if ((counts.get(moduleProcess.name) ?? 0) === 1) {
      return moduleProcess;
    }

    const nextName = duplicateProcessName(moduleProcess.name, nextIndexes, reservedNames);
    reservedNames.add(nextName);
    return {
      name: nextName,
      start: () => moduleProcess.start()
    };
  });
}

function duplicateProcessName(
  processName: string,
  nextIndexes: Map<string, number>,
  reservedNames: Set<string>
): string {
  let nextIndex = nextIndexes.get(processName) ?? 1;
  let nextName = `${processName}#${String(nextIndex)}`;

  while (reservedNames.has(nextName)) {
    nextIndex += 1;
    nextName = `${processName}#${String(nextIndex)}`;
  }

  nextIndexes.set(processName, nextIndex + 1);
  return nextName;
}

function createRpcClient<TProcedures extends ProcedureMap>(
  moduleName: string,
  currentRegistry: () => RegistryConnection | undefined
): RpcClient<TProcedures> {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'then') {
          return undefined;
        }
        if (typeof property !== 'string') {
          return undefined;
        }

        return async (input?: unknown) => {
          const registryConnection = currentRegistry();
          if (registryConnection === undefined) {
            throw new Error('Module RPC is not connected');
          }

          const moduleRecord = moduleByName(registryConnection.getSnapshot(), moduleName);
          if (moduleRecord === undefined) {
            throw new Error(`Module is not registered: ${moduleName}`);
          }
          if (!moduleRecord.procedures.includes(property)) {
            throw new Error(`Procedure is not registered by module ${moduleName}: ${property}`);
          }

          return callProcedure(moduleRecord.rpcUrl, property, input);
        };
      }
    }
  ) as RpcClient<TProcedures>;
}
