import type { EventBus } from '@agentg/events/bus';

import type { HistorySyncDatabase as AppDatabase } from '../database.js';
import type { TelegramReadClient } from '../telegramClient.js';
import type { HistorySyncRpcContext } from './trpc.js';

export type HistorySyncRuntime = {
  database: AppDatabase;
  eventBus: EventBus;
  requestSync?: (reason: string, chatId?: string) => void;
  telegram?: TelegramReadClient;
};

export type CreateHistorySyncRouterOptions = HistorySyncRuntime;

export function runtimeForCall(
  options: CreateHistorySyncRouterOptions,
  ctx: HistorySyncRpcContext
): CreateHistorySyncRouterOptions {
  if (ctx.eventBus === undefined || ctx.eventBus === options.eventBus) {
    return options;
  }

  return {
    ...options,
    eventBus: ctx.eventBus
  };
}
