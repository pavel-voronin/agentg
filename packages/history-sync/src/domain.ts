import type { EventBus } from '@agentg/events/bus';
import { defineDomain } from '@agentg/framework/domain';

import { createHistorySyncControlPlane } from './control-plane/manifest.js';
import type { HistorySyncDatabase } from './database.js';
import { deleteTarget } from './rpc/deleteTarget.js';
import { getChatHistorySyncState } from './rpc/getChatHistorySyncState.js';
import { requestSync } from './rpc/requestSync.js';
import { upsertTarget } from './rpc/upsertTarget.js';
import type { TelegramReadClient } from './telegramClient.js';

export const HISTORY_SYNC_EVENT_TYPES = [
  'history-sync.sync.accepted',
  'history-sync.sync.completed',
  'history-sync.sync.failed',
  'history-sync.sync.requested',
  'history-sync.sync.started',
  'history-sync.target.auto_deleted',
  'history-sync.target.deleted',
  'history-sync.target.upserted'
] as const;

export type HistorySyncRuntime = {
  database: HistorySyncDatabase;
  eventBus: EventBus;
  requestSync?: (reason: string, chatId?: string) => void;
  telegram?: TelegramReadClient;
};

export const historySyncDomain = defineDomain({
  controlPlane: ({ assetVersion, assetVersions }) =>
    createHistorySyncControlPlane(assetVersion, assetVersions),
  createRuntime(runtime: HistorySyncRuntime): HistorySyncRuntime {
    return runtime;
  },
  events: HISTORY_SYNC_EVENT_TYPES,
  procedures: {
    deleteTarget,
    getChatHistorySyncState,
    requestSync,
    upsertTarget
  },
  required: true,
  slug: 'history-sync'
});

export const createHistorySyncRpcClient = historySyncDomain.createRpcClient;
export const createHistorySyncServiceManifest = (
  config: Parameters<typeof historySyncDomain.createServiceManifest>[0]
) => historySyncDomain.createServiceManifest(config);
export type HistorySyncRouter = ReturnType<typeof historySyncDomain.createRpcRouter>;
export type HistorySyncRpcClient = ReturnType<typeof createHistorySyncRpcClient>;
