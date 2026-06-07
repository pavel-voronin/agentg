import { type ModuleManifest, type ModuleRecord, type Snapshot } from './contracts.js';

export type Registry = {
  getSnapshot(): Snapshot;
  join(input: ModuleManifest, now?: Date): Snapshot;
  version(): number;
};

type StoredModuleRecord = ModuleRecord & {
  manifestKey: string;
};

export function createRegistry(): Registry {
  const modules = new Map<string, StoredModuleRecord>();
  let version = 0;

  return {
    getSnapshot() {
      return snapshot(modules, version);
    },
    join(input, now = new Date()) {
      const manifest = normalizeManifest(input);
      const existing = modules.get(manifest.module);
      const manifestKey = stableManifestKey(manifest);

      modules.set(manifest.module, {
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

      return snapshot(modules, version);
    },
    version() {
      return version;
    }
  };
}

function normalizeManifest(input: ModuleManifest): ModuleRecord {
  return {
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
    module: moduleRecord.module,
    procedures: moduleRecord.procedures,
    registeredAt: moduleRecord.registeredAt,
    required: moduleRecord.required,
    rpcUrl: moduleRecord.rpcUrl
  };
}

function stableManifestKey(input: ModuleRecord): string {
  return JSON.stringify({
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

function compareModules(left: ModuleRecord, right: ModuleRecord): number {
  return left.module.localeCompare(right.module);
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
