export function createHistorySyncServiceManifest(config: { rpcUrl: string }) {
  return {
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
    procedures: [
      'history.deleteTarget',
      'history.getChatHistoryState',
      'history.getChatStats',
      'history.getOverview',
      'history.listJobs',
      'history.requestSync',
      'history.upsertTarget'
    ],
    required: true,
    rpcUrl: config.rpcUrl,
    slug: 'history-sync'
  };
}
