import type { EventBus, EventBusFactory } from './events/eventBus.js';
import { createLogger, logError } from './log.js';
import { createLivePolicyValue } from './policies/live.js';
import type { PolicyClientFactory } from './policies/client.js';
import type { PolicyDefinition } from './policies/definition.js';
import type { PolicyResolvedValue } from './policies/resolvers.js';
import type { ProcedureServer, RpcFactory } from './rpc/rpc.js';
import { startTelemetryRuntime } from './telemetry/recorder.js';
import type { MaybePromise, ProcedureMap } from './types.js';

type StopProcess = () => MaybePromise<undefined>;

type ProcessStartResult = undefined | StopProcess | { stop?: StopProcess | undefined };

declare const moduleProcedures: unique symbol;

export type ProceduresOf<TModule> = TModule extends {
  readonly [moduleProcedures]: infer TProcedures;
}
  ? TProcedures extends ProcedureMap
    ? TProcedures
    : never
  : never;

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

export type ModuleApp = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

export type ModuleCreateOptions<TConfig> = {
  config: TConfig;
  connect: ModuleConnect;
};

export type ModuleConnect = {
  events: EventBusFactory;
  policies?: PolicyClientFactory;
  rpc?: RpcFactory | undefined;
};

export type ModuleDefinition<
  TConfig = unknown,
  TProcedures extends ProcedureMap = ProcedureMap
> = ((options: ModuleCreateOptions<TConfig>) => ModuleApp) & {
  readonly config: ModuleConfigReader<TConfig>;
  readonly [moduleProcedures]: TProcedures;
};

export type ModuleConfigReader<TConfig> = (...sources: never[]) => TConfig;

type ModuleDefinitionInput<TConfig, TProcedures extends ProcedureMap> = {
  readonly config: ModuleConfigReader<TConfig>;
  readonly setup: (module: ModuleSetup<TConfig>) => TProcedures;
};

type ModuleSetup<TConfig = unknown> = {
  readonly config: TConfig;
  readonly events: EventBus;
  background: (name: string, start: ModuleProcess['start']) => void;
  resource: <T>(name: string, create: (resource: ResourceSetup) => T) => T;
  startup: (name: string, start: ModuleProcess['start']) => void;
  usePolicy: <TSpec, TValue extends PolicyResolvedValue>(
    definition: PolicyDefinition<TSpec, TValue>,
    options?: {
      onChange?: ((value: Readonly<TValue>) => Promise<void> | void) | undefined;
    }
  ) => () => Readonly<TValue>;
};

export function defineModule<TConfig, TProcedures extends ProcedureMap>(
  name: string,
  input: ModuleDefinitionInput<TConfig, TProcedures>
): ModuleDefinition<TConfig, TProcedures> {
  const definition = (options: ModuleCreateOptions<TConfig>) =>
    createModuleApp<TConfig>(name, input.setup, options);

  return Object.assign(definition, {
    config: input.config
  }) as ModuleDefinition<TConfig, TProcedures>;
}

function createModuleApp<TConfig>(
  name: string,
  setup: (module: ModuleSetup<TConfig>) => ProcedureMap,
  options: ModuleCreateOptions<TConfig>
): ModuleApp {
  const backgroundProcesses: ModuleProcess[] = [];
  const resources = new Map<string, unknown>();
  const startupProcesses: ModuleProcess[] = [];
  const events = options.connect.events();
  const logger = createLogger(name);
  const policyClient = options.connect.policies?.();
  let running = false;
  let runningBackgroundProcesses: RunningProcess[] = [];
  let runningProcedureServer: ProcedureServer | undefined;
  let runningStartupProcesses: RunningProcess[] = [];
  let runningTelemetryRuntime: StopProcess | undefined;

  function usePolicy<TSpec, TValue extends PolicyResolvedValue>(
    definition: PolicyDefinition<TSpec, TValue>,
    options?: {
      onChange?: ((value: Readonly<TValue>) => Promise<void> | void) | undefined;
    }
  ): () => Readonly<TValue> {
    if (policyClient === undefined) {
      throw new Error(
        `Module ${name} uses policy ${definition.kind}, but connect.policies is not configured`
      );
    }
    const live = createLivePolicyValue({
      client: policyClient,
      definition,
      events,
      logger,
      moduleName: name,
      onChange: options?.onChange
    });
    pushProcess(startupProcesses, `policy.${definition.kind}`, () => live.start());
    return () => live.read();
  }

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
    startup(startupName, start) {
      pushProcess(startupProcesses, startupName, start);
    },
    usePolicy
  };

  const procedures = setup(moduleSetup);
  const namedBackgroundProcesses = namedProcesses(backgroundProcesses);
  const namedStartupProcesses = namedProcesses(startupProcesses);
  return {
    async start() {
      if (running) {
        return;
      }

      const startedBackground: RunningProcess[] = [];
      const startedStartup: RunningProcess[] = [];
      let procedureServer: ProcedureServer | undefined;
      try {
        runningTelemetryRuntime = startTelemetryRuntime(name);
        await events.start();
        for (const moduleProcess of namedStartupProcesses) {
          const stop = normalizeProcessStop(await moduleProcess.start());
          startedStartup.push({ name: moduleProcess.name, stop });
        }
        runningStartupProcesses = startedStartup;
        procedureServer = await startProcedureServer(name, options.connect.rpc, procedures);
        runningProcedureServer = procedureServer;
        for (const moduleProcess of namedBackgroundProcesses) {
          const stop = normalizeProcessStop(await moduleProcess.start());
          startedBackground.push({ name: moduleProcess.name, stop });
        }
        runningBackgroundProcesses = startedBackground;
        running = true;
        logger.info(
          {
            event: 'module.started'
          },
          'module started'
        );
      } catch (error) {
        logger.error(
          {
            event: 'module.start_failed',
            ...logError(error)
          },
          'module start failed'
        );
        await stopProcesses(startedBackground);
        if (procedureServer !== undefined) {
          await procedureServer.stop();
        }
        await stopProcesses(startedStartup);
        await stopCallbacks(runningTelemetryRuntime === undefined ? [] : [runningTelemetryRuntime]);
        runningTelemetryRuntime = undefined;
        await events.stop();
        runningBackgroundProcesses = [];
        runningStartupProcesses = [];
        runningProcedureServer = undefined;
        running = false;
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
      const procedureServer = runningProcedureServer;
      runningProcedureServer = undefined;
      if (procedureServer !== undefined) {
        await procedureServer.stop();
      }
      const startupToStop = runningStartupProcesses;
      runningStartupProcesses = [];
      await stopProcesses(startupToStop);
      await stopCallbacks(runningTelemetryRuntime === undefined ? [] : [runningTelemetryRuntime]);
      runningTelemetryRuntime = undefined;
      await events.stop();
      logger.info(
        {
          event: 'module.stopped'
        },
        'module stopped'
      );
    }
  };
}

async function startProcedureServer(
  name: string,
  rpc: RpcFactory | undefined,
  procedures: ProcedureMap
): Promise<ProcedureServer | undefined> {
  if (Object.keys(procedures).length === 0) {
    return undefined;
  }
  if (rpc === undefined) {
    throw new Error(`Module ${name} exposes RPC procedures, but connect.rpc is not configured`);
  }
  return rpc.start(procedures);
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
