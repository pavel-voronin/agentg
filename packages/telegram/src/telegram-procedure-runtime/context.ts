import type { EventBus } from '@agentg/events/bus';

import type { TelegramDatabase } from '../database.js';
import type { TdlibInvoker } from '../telegramOperationEvents.js';
import type { TelegramFileSubsystem } from '../telegramFileSubsystem.js';

export type TelegramProcedureContext = {
  client: TdlibInvoker;
  database: TelegramDatabase;
  eventBus: EventBus;
  files: TelegramFileSubsystem;
};
