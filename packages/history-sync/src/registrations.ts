import { createHistorySyncControlPlane } from './control-plane/manifest.js';
import { historySyncRpc } from './rpc/setup.js';

export function createHistorySyncServiceManifest(config: {
  controlPlaneAssetVersion: string;
  controlPlaneAssetVersions: Readonly<Record<string, string>>;
  rpcUrl: string;
}) {
  return {
    controlPlane: createHistorySyncControlPlane(
      config.controlPlaneAssetVersion,
      config.controlPlaneAssetVersions
    ),
    events: [
      'history-sync.sync.accepted',
      'history-sync.sync.completed',
      'history-sync.sync.failed',
      'history-sync.sync.requested',
      'history-sync.sync.started',
      'history-sync.target.auto_deleted',
      'history-sync.target.deleted',
      'history-sync.target.upserted'
    ],
    extensions: [],
    procedures: historySyncRpc.procedures(),
    required: true,
    rpcUrl: config.rpcUrl,
    slug: 'history-sync'
  };
}
