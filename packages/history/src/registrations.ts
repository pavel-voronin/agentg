import { historyControlPlane } from './control-plane/manifest.js';
import { historyRpcSurface } from './rpc/surface.js';

export function createHistoryServiceManifest(config: { rpcUrl: string }) {
  return {
    controlPlane: historyControlPlane,
    events: [
      'history.coverage.changed',
      'history.job.completed',
      'history.job.created',
      'history.job.failed',
      'history.job.progress',
      'history.job.started',
      'history.reconcile.completed',
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
