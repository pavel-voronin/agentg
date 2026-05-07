import type { EventBus } from '@agentg/events/bus';

import type { TelegramDatabase as AppDatabase } from '../database.js';

export type TelegramClient = {
  invoke(request: Record<string, unknown>): Promise<unknown>;
};

export type TelegramRpcRuntime = {
  client: TelegramClient;
  database: AppDatabase;
  eventBus: EventBus;
};
