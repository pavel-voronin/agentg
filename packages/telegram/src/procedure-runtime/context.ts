import type { EventBus } from '@agentg/events/bus';

import type { TelegramDatabase } from '../database/client.js';
import type { TdlibInvoker } from '../tdlib/operationEvents.js';
import type { TelegramFileSubsystem } from '../files/subsystem.js';
import type { TelegramTdlibOperations } from '../tdlib/operations.js';

export type TelegramProcedureContext = {
  client: TdlibInvoker;
  database: TelegramDatabase;
  eventBus: EventBus;
  files: TelegramFileSubsystem;
  tdlib: TelegramTdlibOperations;
};
