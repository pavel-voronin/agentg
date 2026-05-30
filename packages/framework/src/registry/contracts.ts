export const DEFAULT_REGISTRY_LEASE_TTL_MS = 60_000;
export const DEFAULT_RENEW_INTERVAL_MS = 30_000;
export const CHANGED_EVENT = 'registry.changed';

export type ExtensionInput = {
  extension: string;
  target: string;
};

export type ModuleManifest = {
  extensions?: readonly ExtensionInput[] | undefined;
  module: string;
  procedures?: readonly string[] | undefined;
  required?: boolean | undefined;
  rpcUrl: string;
};

export type LeaseRenewInput = {
  leaseToken: string;
  module: string;
};

export type Lease = {
  expiresAt: string;
  leaseToken: string;
  module: string;
};

export type ModuleRecord = {
  expiresAt: string;
  extensions: readonly ExtensionInput[];
  module: string;
  procedures: readonly string[];
  registeredAt: string;
  required: boolean;
  rpcUrl: string;
};

export type ExtensionRecord = ExtensionInput & {
  expiresAt: string;
  module: string;
  registeredAt: string;
  rpcUrl: string;
};

export type Snapshot = {
  modules: readonly ModuleRecord[];
  version: number;
};

export type JoinOutput = {
  lease: Lease;
  snapshot: Snapshot;
};

export type RenewOutput = JoinOutput;
