import type { EventBus } from '@agentg/events/bus';

import type { TelegramDatabase as AppDatabase } from '../database.js';
import type { TdlibInvoker } from '../tdlib/operationEvents.js';
import type { TelegramFileSubsystem } from '../fileSubsystem.js';
import {
  createTelegramTdlibOperations,
  type TelegramTdlibOperations
} from '../tdlib/operations.js';

export type TelegramClient = TdlibInvoker;

export type TelegramRpcRuntimeDeps = {
  client: TelegramClient;
  database: AppDatabase;
  eventBus: EventBus;
  files: TelegramFileSubsystem;
};

export type TelegramRpcRuntime = TelegramRpcRuntimeDeps & {
  tdlib: TelegramTdlibOperations;
};

export function createTelegramRpcRuntime(deps: TelegramRpcRuntimeDeps): TelegramRpcRuntime {
  return {
    ...deps,
    tdlib: createTelegramTdlibOperations({
      client: deps.client,
      eventBus: deps.eventBus
    })
  };
}
