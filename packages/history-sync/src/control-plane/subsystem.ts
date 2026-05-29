import type { ControlPlaneSubsystem, DomainControlPlaneConfig } from '@agentg/framework/domain';

import { createHistorySyncControlPlane } from './manifest.js';

export type HistorySyncControlPlane = ReturnType<typeof createHistorySyncControlPlane>;

export class HistorySyncControlPlaneSubsystem implements ControlPlaneSubsystem<HistorySyncControlPlane> {
  createControlPlane(config: DomainControlPlaneConfig): HistorySyncControlPlane {
    return createHistorySyncControlPlane(config.assetVersion, config.assetVersions);
  }
}
