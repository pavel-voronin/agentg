import type { EventBus } from '../events/eventBus.js';
import type { ModuleManifest, Snapshot } from './contracts.js';

export type RegistryConnection = {
  close(): void;
  getSnapshot(): Snapshot;
  refresh(): Promise<Snapshot>;
};

export type RegistryConnectOptions = {
  events: EventBus;
  manifest: ModuleManifest;
};

export type RegistryConnector = {
  connect(options: RegistryConnectOptions): Promise<RegistryConnection>;
};
