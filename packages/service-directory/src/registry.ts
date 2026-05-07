import { randomUUID } from 'node:crypto';

import {
  DEFAULT_SERVICE_DIRECTORY_LEASE_TTL_MS,
  serviceDirectoryLeaseRenewInputSchema,
  serviceDirectoryManifestInputSchema,
  type ServiceDirectoryJoinOutput,
  type ServiceDirectoryLeaseRenewInput,
  type ServiceDirectoryManifestInput,
  type ServiceDirectoryProcedureRecord,
  type ServiceDirectoryRenewOutput,
  type ServiceDirectoryServiceRecord,
  type ServiceDirectorySnapshot
} from './rpc/contracts.js';

export type ServiceDirectoryChange<T> = {
  changed: boolean;
  output: T;
};

export type ServiceDirectory = {
  getSnapshot(now?: Date): ServiceDirectoryChange<ServiceDirectorySnapshot>;
  join(
    input: ServiceDirectoryManifestInput,
    now?: Date
  ): ServiceDirectoryChange<ServiceDirectoryJoinOutput>;
  renew(
    input: ServiceDirectoryLeaseRenewInput,
    now?: Date
  ): ServiceDirectoryChange<ServiceDirectoryRenewOutput>;
};

type StoredServiceRecord = ServiceDirectoryServiceRecord & {
  leaseToken: string;
  manifestKey: string;
};

export function createServiceDirectory(options: { ttlMs?: number } = {}): ServiceDirectory {
  const ttlMs = options.ttlMs ?? DEFAULT_SERVICE_DIRECTORY_LEASE_TTL_MS;
  const services = new Map<string, StoredServiceRecord>();
  let version = 0;

  return {
    getSnapshot(now = new Date()): ServiceDirectoryChange<ServiceDirectorySnapshot> {
      const changed = cleanupExpiredServices(services, now, () => {
        version += 1;
      });

      return {
        changed,
        output: snapshot(services, version)
      };
    },
    join(input, now = new Date()): ServiceDirectoryChange<ServiceDirectoryJoinOutput> {
      const expiredChanged = cleanupExpiredServices(services, now, () => {
        version += 1;
      });
      const parsed = serviceDirectoryManifestInputSchema.parse(input);
      const existing = services.get(parsed.slug);
      const manifestKey = stableManifestKey(parsed);
      const manifestChanged = existing?.manifestKey !== manifestKey;
      const leaseToken = `lease_${randomUUID()}`;
      const expiresAt = new Date(now.getTime() + ttlMs);

      services.set(parsed.slug, {
        events: uniqueSorted(parsed.events),
        expiresAt: expiresAt.toISOString(),
        extensions: uniqueExtensions(parsed.extensions),
        leaseToken,
        manifestKey,
        procedures: uniqueProcedures(parsed.procedures),
        registeredAt: existing?.registeredAt ?? now.toISOString(),
        required: parsed.required,
        rpcUrl: parsed.rpcUrl,
        slug: parsed.slug
      });

      if (manifestChanged) {
        version += 1;
      }

      return {
        changed: expiredChanged || manifestChanged,
        output: {
          lease: {
            expiresAt: expiresAt.toISOString(),
            leaseToken,
            slug: parsed.slug
          },
          snapshot: snapshot(services, version)
        }
      };
    },
    renew(input, now = new Date()): ServiceDirectoryChange<ServiceDirectoryRenewOutput> {
      const expiredChanged = cleanupExpiredServices(services, now, () => {
        version += 1;
      });
      const parsed = serviceDirectoryLeaseRenewInputSchema.parse(input);
      const existing = services.get(parsed.slug);
      if (existing?.leaseToken !== parsed.leaseToken) {
        throw new Error(`Service lease is not active: ${parsed.slug}`);
      }

      const expiresAt = new Date(now.getTime() + ttlMs);
      existing.expiresAt = expiresAt.toISOString();

      return {
        changed: expiredChanged,
        output: {
          lease: {
            expiresAt: existing.expiresAt,
            leaseToken: existing.leaseToken,
            slug: existing.slug
          },
          snapshot: snapshot(services, version)
        }
      };
    }
  };
}

function cleanupExpiredServices(
  services: Map<string, StoredServiceRecord>,
  now: Date,
  onChanged: () => void
): boolean {
  let changed = false;
  for (const [slug, service] of services) {
    if (Date.parse(service.expiresAt) <= now.getTime()) {
      services.delete(slug);
      changed = true;
    }
  }

  if (changed) {
    onChanged();
  }

  return changed;
}

function snapshot(
  services: Map<string, StoredServiceRecord>,
  version: number
): ServiceDirectorySnapshot {
  const serviceRecords = [...services.values()].sort(compareServices).map(publicServiceRecord);

  return {
    extensions: serviceRecords.flatMap((service) =>
      service.extensions.map((extension) => ({
        expiresAt: service.expiresAt,
        extension: extension.extension,
        registeredAt: service.registeredAt,
        rpcUrl: service.rpcUrl,
        serviceSlug: service.slug,
        target: extension.target
      }))
    ),
    services: serviceRecords,
    version
  };
}

function publicServiceRecord(service: StoredServiceRecord): ServiceDirectoryServiceRecord {
  return {
    events: service.events,
    expiresAt: service.expiresAt,
    extensions: service.extensions,
    procedures: service.procedures,
    registeredAt: service.registeredAt,
    required: service.required,
    rpcUrl: service.rpcUrl,
    slug: service.slug
  };
}

function stableManifestKey(input: ServiceDirectoryManifestInput): string {
  return JSON.stringify({
    events: uniqueSorted(input.events ?? []),
    extensions: uniqueExtensions(input.extensions ?? []),
    procedures: uniqueProcedures(input.procedures ?? []),
    required: input.required,
    rpcUrl: input.rpcUrl,
    slug: input.slug
  });
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function uniqueExtensions(
  values: NonNullable<ServiceDirectoryManifestInput['extensions']>
): NonNullable<ServiceDirectoryManifestInput['extensions']> {
  return [
    ...new Map(
      values
        .map((extension) => ({
          extension: extension.extension,
          target: extension.target
        }))
        .sort(compareExtensions)
        .map((extension) => [`${extension.target}\u0000${extension.extension}`, extension])
    ).values()
  ];
}

function uniqueProcedures(
  values: NonNullable<ServiceDirectoryManifestInput['procedures']>
): ServiceDirectoryProcedureRecord[] {
  return [
    ...new Map(
      values
        .map((procedure) => ({
          kind: procedure.kind,
          name: procedure.name
        }))
        .sort(compareProcedures)
        .map((procedure) => [procedure.name, procedure])
    ).values()
  ];
}

function compareServices(
  left: ServiceDirectoryServiceRecord,
  right: ServiceDirectoryServiceRecord
) {
  return left.slug.localeCompare(right.slug);
}

function compareProcedures(
  left: ServiceDirectoryProcedureRecord,
  right: ServiceDirectoryProcedureRecord
): number {
  return left.name.localeCompare(right.name);
}

function compareExtensions(
  left: NonNullable<ServiceDirectoryManifestInput['extensions']>[number],
  right: NonNullable<ServiceDirectoryManifestInput['extensions']>[number]
): number {
  const targetOrder = left.target.localeCompare(right.target);
  return targetOrder === 0 ? left.extension.localeCompare(right.extension) : targetOrder;
}
