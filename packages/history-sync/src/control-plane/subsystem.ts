import type { ControlPlaneSubsystem, ModuleControlPlaneConfig } from '@agentg/framework';

import { createHistorySyncControlPlane } from './manifest.js';

export type HistorySyncControlPlane = ReturnType<typeof createHistorySyncControlPlane>;

export class HistorySyncControlPlaneSubsystem implements ControlPlaneSubsystem<HistorySyncControlPlane> {
  createControlPlane(config: ModuleControlPlaneConfig): HistorySyncControlPlane {
    return createHistorySyncControlPlane(config.assetVersion, config.assetVersions);
  }
}
