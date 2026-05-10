import { createHistoryControlPlane } from './control-plane/manifest.js';
import { historyRpcSurface } from './rpc/surface.js';

export function createHistoryServiceManifest(config: {
  controlPlaneAssetVersion: string;
  controlPlaneAssetVersions: Readonly<Record<string, string>>;
  rpcUrl: string;
}) {
  return {
    controlPlane: createHistoryControlPlane(
      config.controlPlaneAssetVersion,
      config.controlPlaneAssetVersions
    ),
    events: [
      'history.sync.accepted',
      'history.sync.completed',
      'history.sync.failed',
      'history.sync.requested',
      'history.sync.started',
      'history.target.auto_deleted',
      'history.target.deleted',
      'history.target.upserted'
    ],
    extensions: [],
    procedures: historyRpcSurface.procedures(),
    required: true,
    rpcUrl: config.rpcUrl,
    slug: 'history'
  };
}
