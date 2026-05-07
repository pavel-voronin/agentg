import type { ModuleRuntimeConfig } from '@agentg/infra/modules/runtime';

import { summariesRpcSurface } from './rpc/surface.js';

export function createSummariesServiceManifest(config: ModuleRuntimeConfig) {
  return {
    events: [
      'summaries.summary.completed',
      'summaries.summary.invalidated',
      'summaries.summary.requested'
    ],
    extensions: config.extensions,
    procedures: summariesRpcSurface.procedures(),
    required: false,
    rpcUrl: config.serviceRpcUrl,
    slug: config.slug
  };
}
