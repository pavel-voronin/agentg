export function createHistoryServiceManifest(config: { rpcUrl: string }) {
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
      { kind: 'mutation' as const, name: 'history.deleteTarget' },
      { kind: 'query' as const, name: 'history.getChatHistoryState' },
      { kind: 'query' as const, name: 'history.getChatStats' },
      { kind: 'query' as const, name: 'history.getOverview' },
      { kind: 'query' as const, name: 'history.listJobs' },
      { kind: 'mutation' as const, name: 'history.requestSync' },
      { kind: 'mutation' as const, name: 'history.upsertTarget' }
    ],
    required: true,
    rpcUrl: config.rpcUrl,
    slug: 'history'
  };
}
