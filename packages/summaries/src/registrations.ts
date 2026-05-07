import type { ModuleRuntimeConfig } from '@agentg/infra/modules/runtime';

export function createSummariesServiceManifest(config: ModuleRuntimeConfig) {
  return {
    events: [
      'summaries.summary.completed',
      'summaries.summary.invalidated',
      'summaries.summary.requested'
    ],
    extensions: config.extensions,
    procedures: [
      { kind: 'query' as const, name: 'summaries.chatSummary' },
      { kind: 'query' as const, name: 'summaries.readChatSummary' },
      { kind: 'query' as const, name: 'summaries.readSummaryRun' },
      { kind: 'mutation' as const, name: 'summaries.requestSummary' }
    ],
    required: false,
    rpcUrl: config.serviceRpcUrl,
    slug: config.slug
  };
}
