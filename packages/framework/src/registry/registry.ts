import { randomUUID } from 'node:crypto';

import {
  DEFAULT_REGISTRY_LEASE_TTL_MS,
  type ExtensionInput,
  type JoinOutput,
  type LeaseRenewInput,
  type ModuleManifest,
  type ModuleRecord,
  type RenewOutput,
  type Snapshot
} from './contracts.js';

export type Registry = {
  getSnapshot(now?: Date): Snapshot;
  join(input: ModuleManifest, now?: Date): JoinOutput;
  renew(input: LeaseRenewInput, now?: Date): RenewOutput;
  version(): number;
};

type StoredModuleRecord = ModuleRecord & {
  leaseToken: string;
  manifestKey: string;
};

export function createRegistry(options: { ttlMs?: number } = {}): Registry {
  const ttlMs = options.ttlMs ?? DEFAULT_REGISTRY_LEASE_TTL_MS;
  const modules = new Map<string, StoredModuleRecord>();
  let version = 0;

  return {
    getSnapshot(now = new Date()) {
      cleanupExpiredModules(modules, now, () => {
        version += 1;
      });
      return snapshot(modules, version);
    },
    join(input, now = new Date()) {
      cleanupExpiredModules(modules, now, () => {
        version += 1;
      });
      const manifest = normalizeManifest(input);
      const existing = modules.get(manifest.module);
      const manifestKey = stableManifestKey(manifest);
      const leaseToken = `lease_${randomUUID()}`;
      const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

      modules.set(manifest.module, {
        expiresAt,
        extensions: manifest.extensions,
        leaseToken,
        manifestKey,
        module: manifest.module,
        procedures: manifest.procedures,
        registeredAt: existing?.registeredAt ?? now.toISOString(),
        required: manifest.required,
        rpcUrl: manifest.rpcUrl
      });

      if (existing?.manifestKey !== manifestKey) {
        version += 1;
      }

      return {
        lease: {
          expiresAt,
          leaseToken,
          module: manifest.module
        },
        snapshot: snapshot(modules, version)
      };
    },
    renew(input, now = new Date()) {
      cleanupExpiredModules(modules, now, () => {
        version += 1;
      });
      const moduleName = requireText(input.module, 'module');
      const leaseToken = requireText(input.leaseToken, 'leaseToken');
      const existing = modules.get(moduleName);
      if (existing?.leaseToken !== leaseToken) {
        throw new Error(`Module lease is not active: ${moduleName}`);
      }

      existing.expiresAt = new Date(now.getTime() + ttlMs).toISOString();

      return {
        lease: {
          expiresAt: existing.expiresAt,
          leaseToken: existing.leaseToken,
          module: existing.module
        },
        snapshot: snapshot(modules, version)
      };
    },
    version() {
      return version;
    }
  };
}

function cleanupExpiredModules(
  modules: Map<string, StoredModuleRecord>,
  now: Date,
  onChanged: () => void
): void {
  let changed = false;
  for (const [moduleName, moduleRecord] of modules) {
    if (Date.parse(moduleRecord.expiresAt) <= now.getTime()) {
      modules.delete(moduleName);
      changed = true;
    }
  }

  if (changed) {
    onChanged();
  }
}

function normalizeManifest(input: ModuleManifest): ModuleRecord {
  return {
    expiresAt: '',
    extensions: uniqueExtensions(input.extensions ?? []),
    module: requireText(input.module, 'module'),
    procedures: uniqueSorted(input.procedures ?? []),
    registeredAt: '',
    required: input.required ?? false,
    rpcUrl: requireHttpUrl(input.rpcUrl)
  };
}

function snapshot(modules: Map<string, StoredModuleRecord>, version: number): Snapshot {
  const moduleRecords = [...modules.values()].sort(compareModules).map(publicModuleRecord);

  return {
    modules: moduleRecords,
    version
  };
}

function publicModuleRecord(moduleRecord: StoredModuleRecord): ModuleRecord {
  return {
    expiresAt: moduleRecord.expiresAt,
    extensions: moduleRecord.extensions,
    module: moduleRecord.module,
    procedures: moduleRecord.procedures,
    registeredAt: moduleRecord.registeredAt,
    required: moduleRecord.required,
    rpcUrl: moduleRecord.rpcUrl
  };
}

function stableManifestKey(input: ModuleRecord): string {
  return JSON.stringify({
    extensions: input.extensions,
    module: input.module,
    procedures: input.procedures,
    required: input.required,
    rpcUrl: input.rpcUrl
  });
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => requireText(value, 'list item')))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function uniqueExtensions(values: readonly ExtensionInput[]): ExtensionInput[] {
  return [
    ...new Map(
      values
        .map((extension) => ({
          extension: requireText(extension.extension, 'extension'),
          target: requireText(extension.target, 'target')
        }))
        .sort(compareExtensions)
        .map((extension) => [`${extension.target}\u0000${extension.extension}`, extension])
    ).values()
  ];
}

function compareModules(left: ModuleRecord, right: ModuleRecord): number {
  return left.module.localeCompare(right.module);
}

function compareExtensions(left: ExtensionInput, right: ExtensionInput): number {
  const targetOrder = left.target.localeCompare(right.target);
  return targetOrder === 0 ? left.extension.localeCompare(right.extension) : targetOrder;
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${field} must not be empty`);
  }
  return normalized;
}

function requireHttpUrl(value: string): string {
  const parsed = new URL(requireText(value, 'rpcUrl'));
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('rpcUrl must use http or https');
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new Error('rpcUrl must not include credentials');
  }
  return parsed.toString().replace(/\/$/, '');
}
