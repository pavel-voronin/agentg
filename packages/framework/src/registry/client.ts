import type { EventBus, EventSubscription } from '../events/eventBus.js';
import { callProcedure } from '../rpc/httpRpc.js';

import {
  CHANGED_EVENT,
  DEFAULT_RENEW_INTERVAL_MS,
  type ExtensionRecord,
  type JoinOutput,
  type Lease,
  type LeaseRenewInput,
  type ModuleManifest,
  type ModuleRecord,
  type RenewOutput,
  type Snapshot
} from './contracts.js';

export type RegistryClientConfig = {
  events: EventBus;
  onRenewFailure?: ((error: Error) => void) | undefined;
  onRefreshFailure?: ((error: Error) => void) | undefined;
  onTopologyFailure?: ((error: Error) => void) | undefined;
  renewIntervalMs?: number | undefined;
  requestTimeoutMs?: number | undefined;
  url: string;
};

export type RegistryClient = {
  close(): void;
  getSnapshot(): Snapshot;
  join(input: ModuleManifest): Promise<Snapshot>;
  refresh(): Promise<Snapshot>;
  renew(input?: LeaseRenewInput): Promise<Snapshot>;
};

export function createRegistryClient(config: RegistryClientConfig): RegistryClient {
  let lease: Lease | undefined;
  let requiredModules: Set<string> | undefined;
  let snapshot: Snapshot | undefined;
  let renewal: ReturnType<typeof setInterval> | undefined;
  let subscription: EventSubscription | undefined = config.events.subscribe(
    CHANGED_EVENT,
    (event) => {
      handleChangedEvent(event.data);
    }
  );

  return {
    close() {
      stopRenewal();
      subscription?.unsubscribe();
      subscription = undefined;
    },
    getSnapshot() {
      return currentSnapshot();
    },
    async join(input) {
      const output = await callRegistry<JoinOutput>('join', input, config);
      lease = output.lease;
      acceptSnapshot(output.snapshot, { resetRequiredBaseline: true });
      startRenewal();
      return currentSnapshot();
    },
    async refresh() {
      acceptSnapshot(await callRegistry<Snapshot>('getSnapshot', undefined, config));
      return currentSnapshot();
    },
    async renew(input) {
      const output = await callRegistry<RenewOutput>(
        'renew',
        input ?? renewInputFromLease(lease),
        config
      );
      lease = output.lease;
      acceptSnapshot(output.snapshot);
      return currentSnapshot();
    }
  };

  function startRenewal(): void {
    if (renewal !== undefined) {
      return;
    }

    renewal = setInterval(() => {
      void callRegistry<RenewOutput>('renew', renewInputFromLease(lease), config)
        .then((output) => {
          lease = output.lease;
          acceptSnapshot(output.snapshot);
        })
        .catch((error: unknown) => {
          reportAsyncError('registry.renew_failed', error, config.onRenewFailure);
        });
    }, config.renewIntervalMs ?? DEFAULT_RENEW_INTERVAL_MS);
    renewal.unref();
  }

  function stopRenewal(): void {
    if (renewal === undefined) {
      return;
    }
    clearInterval(renewal);
    renewal = undefined;
  }

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

  function handleChangedEvent(data: unknown): void {
    const version = changedVersion(data);
    if (version === undefined || (snapshot !== undefined && version <= snapshot.version)) {
      return;
    }

    void callRegistry<Snapshot>('getSnapshot', undefined, config)
      .then((updated) => {
        acceptSnapshot(updated);
      })
      .catch((error: unknown) => {
        reportAsyncError('registry.refresh_failed', error, config.onRefreshFailure);
      });
  }

  function reportAsyncError(
    event: string,
    error: unknown,
    fallback?: (error: Error) => void
  ): void {
    const normalized = normalizeError(error);
    if (normalized instanceof TopologyError) {
      reportWithFallback('registry.topology_failed', normalized, config.onTopologyFailure);
      return;
    }
    reportWithFallback(event, normalized, fallback);
  }
}

export function procedureUrls(snapshot: Snapshot): Map<string, string> {
  return new Map(
    snapshot.modules.flatMap((moduleRecord) =>
      moduleRecord.procedures.map((procedure) => [procedure, moduleRecord.rpcUrl] as const)
    )
  );
}

export function extensionsForTarget(snapshot: Snapshot, target: string): ExtensionRecord[] {
  return snapshot.modules.flatMap((moduleRecord) =>
    moduleRecord.extensions
      .filter((extension) => extension.target === target)
      .map((extension) => ({
        expiresAt: moduleRecord.expiresAt,
        extension: extension.extension,
        module: moduleRecord.module,
        registeredAt: moduleRecord.registeredAt,
        rpcUrl: moduleRecord.rpcUrl,
        target: extension.target
      }))
  );
}

export function moduleByName(snapshot: Snapshot, moduleName: string): ModuleRecord | undefined {
  return snapshot.modules.find((moduleRecord) => moduleRecord.module === moduleName);
}

function renewInputFromLease(lease: Lease | undefined): LeaseRenewInput {
  if (lease === undefined) {
    throw new Error('Registry lease is not loaded');
  }

  return {
    leaseToken: lease.leaseToken,
    module: lease.module
  };
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

function changedVersion(data: unknown): number | undefined {
  if (
    typeof data === 'object' &&
    data !== null &&
    'version' in data &&
    typeof data.version === 'number'
  ) {
    return data.version;
  }
  return undefined;
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

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function reportWithFallback(
  event: string,
  error: Error,
  fallback: ((error: Error) => void) | undefined
): void {
  if (fallback !== undefined) {
    fallback(error);
    return;
  }

  console.error(
    JSON.stringify({
      error: error.message,
      event
    })
  );
}

class TopologyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryTopologyError';
  }
}
