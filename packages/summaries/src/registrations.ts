import type { ModuleRuntimeConfig } from '@agentg/shared/modules/runtime';

export function createSummariesServiceManifest(config: ModuleRuntimeConfig) {
  return {
    events: [
      'summaries.summary.completed',
      'summaries.summary.invalidated',
      'summaries.summary.requested'
    ],
    extensions: config.extensions,
    procedures: [
      'summaries.chatSummary',
      'summaries.readChatSummary',
      'summaries.readSummaryRun',
      'summaries.requestSummary'
    ],
    required: false,
    rpcUrl: config.serviceRpcUrl,
    slug: config.slug
  };
}
