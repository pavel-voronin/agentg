import type { EventBus } from '@agentg/events/bus';
import type { InternalTrpcContext } from '@agentg/rpc/trpc';
import { defineInternalRpcDomain } from '@agentg/rpc/domain';

import type { HistorySyncDatabase as AppDatabase } from '../database.js';
import type { TelegramReadClient } from '../telegramClient.js';
import { deleteTarget } from './procedures/deleteTarget.js';
import { getChatHistorySyncState } from './procedures/getChatHistorySyncState.js';
import { requestSync } from './procedures/requestSync.js';
import { upsertTarget } from './procedures/upsertTarget.js';

export type HistorySyncRuntime = {
  database: AppDatabase;
  eventBus: EventBus;
  requestSync?: (reason: string, chatId?: string) => void;
  telegram?: TelegramReadClient;
};

export type CreateHistorySyncRouterOptions = HistorySyncRuntime;

export const historySyncRpc = defineInternalRpcDomain({
  createRuntime(options: CreateHistorySyncRouterOptions): HistorySyncRuntime {
    return options;
  },
  procedures: {
    deleteTarget,
    getChatHistorySyncState,
    requestSync,
    upsertTarget
  },
  slug: 'history-sync'
});

export type HistorySyncRouter = ReturnType<typeof historySyncRpc.createRouter>;
export const createHistorySyncRpcClient = historySyncRpc.createClient;
export type HistorySyncRpcClient = ReturnType<typeof createHistorySyncRpcClient>;

export function runtimeForCall(
  options: CreateHistorySyncRouterOptions,
  ctx: InternalTrpcContext
): CreateHistorySyncRouterOptions {
  if (ctx.eventBus === undefined || ctx.eventBus === options.eventBus) {
    return options;
  }

  return {
    ...options,
    eventBus: ctx.eventBus
  };
}
