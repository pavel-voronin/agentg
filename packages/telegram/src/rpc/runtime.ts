import type { EventBus } from '@agentg/events/bus';

import type { TelegramDatabase as AppDatabase } from '../database.js';
import type { TelegramFileIndexer } from '../telegram-file-indexer.js';
import type { TdlibInvoker } from '../telegram-operation-events.js';

export type TelegramClient = TdlibInvoker;

export type TelegramRpcRuntime = {
  client: TelegramClient;
  database: AppDatabase;
  eventBus: EventBus;
  fileIndexer: TelegramFileIndexer;
};
