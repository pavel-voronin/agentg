import { callProcedure } from '../rpc/httpRpc.js';

import { type ModuleManifest, type ModuleRecord, type Snapshot } from './contracts.js';

export type RegistryClientConfig = {
  requestTimeoutMs?: number | undefined;
  url: string;
};

export type RegistryClient = {
  close(): void;
  getSnapshot(): Snapshot;
  join(input: ModuleManifest): Promise<Snapshot>;
  refresh(): Promise<Snapshot>;
};

export function createRegistryClient(config: RegistryClientConfig): RegistryClient {
  let requiredModules: Set<string> | undefined;
  let snapshot: Snapshot | undefined;

  return {
    close() {
      return;
    },
    getSnapshot() {
      return currentSnapshot();
    },
    async join(input) {
      acceptSnapshot(await callRegistry<Snapshot>('join', input, config), {
        resetRequiredBaseline: true
      });
      return currentSnapshot();
    },
    async refresh() {
      acceptSnapshot(await callRegistry<Snapshot>('getSnapshot', undefined, config));
      return currentSnapshot();
    }
  };

  function currentSnapshot(): Snapshot {
    if (snapshot === undefined) {
      throw new Error('Registry snapshot is not loaded');
    }
    return snapshot;
  }

  function acceptSnapshot(
    nextSnapshot: Snapshot,
    options: { resetRequiredBaseline?: boolean } = {}
  ): void {
    if (options.resetRequiredBaseline === true) {
      requiredModules = requiredModuleNames(nextSnapshot);
    } else {
      assertRequiredModules(nextSnapshot, requiredModules);
    }
    snapshot = nextSnapshot;
  }
}

export function procedureUrls(snapshot: Snapshot): Map<string, string> {
  return new Map(
    snapshot.modules.flatMap((moduleRecord) =>
      moduleRecord.procedures.map((procedure) => [procedure, moduleRecord.rpcUrl] as const)
    )
  );
}

export function moduleByName(snapshot: Snapshot, moduleName: string): ModuleRecord | undefined {
  return snapshot.modules.find((moduleRecord) => moduleRecord.module === moduleName);
}

function callRegistry<T>(
  procedure: string,
  input: unknown,
  config: Pick<RegistryClientConfig, 'requestTimeoutMs' | 'url'>
): Promise<T> {
  return callProcedure<T>(
    config.url,
    procedure,
    input,
    config.requestTimeoutMs === undefined ? {} : { timeoutMs: config.requestTimeoutMs }
  );
}

function requiredModuleNames(snapshot: Snapshot): Set<string> {
  return new Set(
    snapshot.modules
      .filter((moduleRecord) => moduleRecord.required)
      .map((moduleRecord) => moduleRecord.module)
  );
}

function assertRequiredModules(snapshot: Snapshot, requiredModules: Set<string> | undefined): void {
  if (requiredModules === undefined || requiredModules.size === 0) {
    return;
  }

  const activeModules = new Set(snapshot.modules.map((moduleRecord) => moduleRecord.module));
  for (const moduleName of requiredModules) {
    if (!activeModules.has(moduleName)) {
      throw new TopologyError(`Required module disappeared from Registry: ${moduleName}`);
    }
  }
}

class TopologyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryTopologyError';
  }
}
