import type { EventBus } from '@agentg/events/bus';

import type { HistoryDatabase as AppDatabase } from '../database.js';
import type { TelegramReadClient } from '../telegram-client.js';
import type { HistoryRpcContext } from './trpc.js';

export type HistoryRuntime = {
  database: AppDatabase;
  eventBus: EventBus;
  requestSync?: (reason: string, chatId?: string) => void;
  telegram?: TelegramReadClient;
};

export type CreateHistoryRouterOptions = HistoryRuntime;

export function runtimeForCall(
  options: CreateHistoryRouterOptions,
  ctx: HistoryRpcContext
): CreateHistoryRouterOptions {
  if (ctx.eventBus === undefined || ctx.eventBus === options.eventBus) {
    return options;
  }

  return {
    ...options,
    eventBus: ctx.eventBus
  };
}
