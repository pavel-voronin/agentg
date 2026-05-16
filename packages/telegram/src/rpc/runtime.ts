import type { EventBus } from '@agentg/events/bus';

import type { TelegramDatabase as AppDatabase } from '../database.js';
import type { TdlibInvoker } from '../telegram-operation-events.js';
import type { TelegramFileSubsystem } from '../telegram-file-subsystem.js';

export type TelegramClient = TdlibInvoker;

export type TelegramRpcRuntime = {
  client: TelegramClient;
  database: AppDatabase;
  eventBus: EventBus;
  files: TelegramFileSubsystem;
};
