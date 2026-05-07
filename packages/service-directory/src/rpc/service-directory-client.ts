import type { EventBus, EventSubscription } from '@agentg/events/bus';
import type { IntegrationEvent } from '@agentg/events/envelope';
import { createTRPCClient, httpBatchLink } from '@trpc/client';

import {
  DEFAULT_SERVICE_DIRECTORY_RENEW_INTERVAL_MS,
  SERVICE_DIRECTORY_CHANGED_EVENT,
  serviceDirectoryLeaseRenewInputSchema,
  serviceDirectoryManifestInputSchema,
  type ServiceDirectoryExtensionRecord,
  type ServiceDirectoryJoinOutput,
  type ServiceDirectoryLease,
  type ServiceDirectoryLeaseRenewInput,
  type ServiceDirectoryManifestInput,
  type ServiceDirectoryProcedureKind,
  type ServiceDirectorySnapshot
} from './contracts.js';
import type { ServiceDirectoryRouter } from './router.js';

export type ServiceDirectoryClientConfig = {
  eventBus?: EventBus | undefined;
  onTopologyFailure?: ((error: Error) => void) | undefined;
  url: string;
};

export type ServiceDirectoryClient = {
  close(): void;
  getSnapshot(): ServiceDirectorySnapshot;
  join(input: ServiceDirectoryManifestInput): Promise<ServiceDirectorySnapshot>;
  extensionsForTarget(target: string): ServiceDirectoryExtensionRecord[];
  refresh(): Promise<ServiceDirectorySnapshot>;
  renew(input?: ServiceDirectoryLeaseRenewInput): Promise<ServiceDirectorySnapshot>;
  resolveProcedure(procedure: string): ServiceDirectoryProcedureCall;
};

export type ServiceDirectoryProcedureCall = {
  kind: ServiceDirectoryProcedureKind;
  rpcUrl: string;
};

const SERVICE_DIRECTORY_REQUEST_TIMEOUT_MS = 15000;

export function createServiceDirectoryClient(
  config: ServiceDirectoryClientConfig
): ServiceDirectoryClient {
  const client = createTRPCClient<ServiceDirectoryRouter>({
    links: [
      httpBatchLink({
        url: parseServiceDirectoryRpcUrl(config.url)
      })
    ]
  });
  let lease: ServiceDirectoryLease | undefined;
  let manifest: ServiceDirectoryManifestInput | undefined;
  let snapshot: ServiceDirectorySnapshot | undefined;
  let renewal: ReturnType<typeof setInterval> | undefined;
  const knownRequiredServices = new Set<string>();
  let subscription: EventSubscription | undefined;
  let topologyFailureReported = false;

  if (config.eventBus !== undefined) {
    subscription = config.eventBus.subscribe(SERVICE_DIRECTORY_CHANGED_EVENT, (event) => {
      handleDirectoryChanged(event);
    });
  }

  return {
    close() {
      if (renewal !== undefined) {
        clearInterval(renewal);
        renewal = undefined;
      }
      subscription?.unsubscribe();
      subscription = undefined;
    },
    getSnapshot() {
      return currentSnapshot();
    },
    async join(input) {
      const parsed = serviceDirectoryManifestInputSchema.parse(input);
      manifest = parsed;
      const output = await callDirectoryProcedure((signal) =>
        client.join.mutate(parsed, { signal })
      );
      lease = output.lease;
      acceptSnapshot(output.snapshot);
      startRenewal();
      return currentSnapshot();
    },
    extensionsForTarget(target) {
      return currentSnapshot().extensions.filter((extension) => extension.target === target);
    },
    async refresh() {
      try {
        acceptSnapshot(
          await callDirectoryProcedure((signal) => client.getSnapshot.query(undefined, { signal }))
        );
        return currentSnapshot();
      } catch (error) {
        reportTopologyFailure(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    },
    async renew(input) {
      const parsed =
        input === undefined
          ? leaseRenewInputFromCurrentLease(lease)
          : serviceDirectoryLeaseRenewInputSchema.parse(input);
      try {
        const output = await callDirectoryProcedure((signal) =>
          client.renew.mutate(parsed, { signal })
        );
        lease = output.lease;
        acceptSnapshot(output.snapshot);
        return currentSnapshot();
      } catch (error) {
        reportTopologyFailure(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    },
    resolveProcedure(procedure) {
      const { procedure: procedureRecord, service } = resolveProcedureRecord(procedure);
      return {
        kind: procedureRecord.kind,
        rpcUrl: service.rpcUrl
      };
    }
  };

  function startRenewal(): void {
    if (renewal !== undefined || manifest === undefined) {
      return;
    }

    renewal = setInterval(() => {
      void callDirectoryProcedure((signal) =>
        client.renew.mutate(leaseRenewInputFromCurrentLease(lease), { signal })
      )
        .then((output: ServiceDirectoryJoinOutput) => {
          lease = output.lease;
          acceptSnapshot(output.snapshot);
        })
        .catch((error: unknown) => {
          reportTopologyFailure(error instanceof Error ? error : new Error(String(error)));
          console.error(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              event: 'service_directory.renew_failed'
            })
          );
        });
    }, DEFAULT_SERVICE_DIRECTORY_RENEW_INTERVAL_MS);
    renewal.unref();
  }

  function handleDirectoryChanged(event: IntegrationEvent): void {
    const version = event.data.version;
    if (typeof version !== 'number') {
      return;
    }
    if (snapshot !== undefined && version <= snapshot.version) {
      return;
    }

    void callDirectoryProcedure((signal) => client.getSnapshot.query(undefined, { signal }))
      .then((updated) => {
        acceptSnapshot(updated);
      })
      .catch((error: unknown) => {
        reportTopologyFailure(error instanceof Error ? error : new Error(String(error)));
        console.error(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            event: 'service_directory.refresh_failed',
            version
          })
        );
      });
  }

  function acceptSnapshot(updated: ServiceDirectorySnapshot): void {
    const currentRequiredServices = new Set(
      updated.services.filter((service) => service.required).map((service) => service.slug)
    );
    const lostRequiredServices = [...knownRequiredServices].filter(
      (slug) => !currentRequiredServices.has(slug)
    );

    snapshot = updated;
    for (const slug of currentRequiredServices) {
      knownRequiredServices.add(slug);
    }

    if (lostRequiredServices.length > 0) {
      reportTopologyFailure(new ServiceDirectoryTopologyError(lostRequiredServices));
    }
  }

  function reportTopologyFailure(error: Error): void {
    if (topologyFailureReported) {
      return;
    }

    topologyFailureReported = true;
    config.onTopologyFailure?.(error);
  }

  function currentSnapshot(): ServiceDirectorySnapshot {
    if (snapshot === undefined) {
      throw new Error('Service Directory snapshot is not loaded');
    }

    return snapshot;
  }

  function resolveProcedureRecord(procedure: string): {
    procedure: ServiceDirectorySnapshot['services'][number]['procedures'][number];
    service: ServiceDirectorySnapshot['services'][number];
  } {
    const serviceSlug = serviceSlugFromProcedure(procedure);
    const service = currentSnapshot().services.find((item) => item.slug === serviceSlug);
    if (service === undefined) {
      throw new ServiceDirectoryProcedureUnavailableError(procedure);
    }

    const procedureRecord = service.procedures.find((item) => item.name === procedure);
    if (procedureRecord !== undefined) {
      return {
        procedure: procedureRecord,
        service
      };
    }

    throw new ServiceDirectoryProcedureUnavailableError(procedure);
  }
}

class ServiceDirectoryProcedureUnavailableError extends Error {
  readonly code = 'dependency_unavailable';

  constructor(readonly procedure: string) {
    super(`Dependency is unavailable: ${procedure}`);
  }
}

class ServiceDirectoryTopologyError extends Error {
  readonly code = 'service_directory_topology_failure';

  constructor(readonly lostRequiredServices: string[]) {
    super(
      `Required services disappeared from Service Directory: ${lostRequiredServices.join(', ')}`
    );
  }
}

function serviceSlugFromProcedure(procedure: string): string {
  const separatorIndex = procedure.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex === procedure.length - 1) {
    throw new ServiceDirectoryProcedureUnavailableError(procedure);
  }

  return procedure.slice(0, separatorIndex);
}

function leaseRenewInputFromCurrentLease(
  lease: ServiceDirectoryLease | undefined
): ServiceDirectoryLeaseRenewInput {
  if (lease === undefined) {
    throw new Error('Service Directory lease is not loaded');
  }

  return {
    leaseToken: lease.leaseToken,
    slug: lease.slug
  };
}

async function callDirectoryProcedure<T>(call: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(
      new Error(
        `Service Directory tRPC timed out after ${String(SERVICE_DIRECTORY_REQUEST_TIMEOUT_MS)}ms`
      )
    );
  }, SERVICE_DIRECTORY_REQUEST_TIMEOUT_MS);
  timeout.unref();

  try {
    return await call(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

function parseServiceDirectoryRpcUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch (error) {
    throw new Error('Service Directory RPC URL must be a valid http(s) URL', { cause: error });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Service Directory RPC URL must use http or https');
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new Error('Service Directory RPC URL must not include credentials');
  }

  if (url.pathname !== '/' || url.search.length > 0 || url.hash.length > 0) {
    throw new Error('Service Directory RPC URL must point to a service root');
  }

  return url.toString().replace(/\/$/, '');
}
