import type { EventBus } from '@agentg/events/bus';
import {
  defineControlPlane,
  defineModule,
  defineEvents,
  defineProcedures,
  registerSubsystem,
  setRequired
} from '@agentg/framework';

import {
  HistorySyncControlPlaneSubsystem,
  type HistorySyncControlPlane
} from './control-plane/subsystem.js';
import type { HistorySyncDatabase } from './database.js';
import { useDatabase } from './database/subsystem.js';
import { useEvents } from './events/subsystem.js';
import { deleteTarget } from './rpc/deleteTarget.js';
import { getChatHistorySyncState } from './rpc/getChatHistorySyncState.js';
import { requestSync } from './rpc/requestSync.js';
import { upsertTarget } from './rpc/upsertTarget.js';
import type { HistorySyncServiceOptions } from './service/runService.js';
import { useService } from './service/subsystem.js';
import { useTelegram } from './telegram/subsystem.js';
import type { TelegramReadClient } from './telegramClient.js';

const EVENT_TYPES = [
  'history-sync.sync.accepted',
  'history-sync.sync.completed',
  'history-sync.sync.failed',
  'history-sync.sync.requested',
  'history-sync.sync.started',
  'history-sync.target.auto_deleted',
  'history-sync.target.deleted',
  'history-sync.target.upserted'
] as const;

type ProcedureResources = {
  database: HistorySyncDatabase;
  eventBus: EventBus;
  requestSync?: (reason: string, chatId?: string) => void;
  telegram?: TelegramReadClient;
};

const procedures = {
  deleteTarget,
  getChatHistorySyncState,
  requestSync,
  upsertTarget
};

const module = defineModule<
  ProcedureResources,
  ProcedureResources,
  typeof procedures,
  HistorySyncControlPlane,
  HistorySyncServiceOptions
>('history-sync', () => {
  defineControlPlane(new HistorySyncControlPlaneSubsystem());
  defineEvents(EVENT_TYPES);
  defineProcedures(procedures);
  setRequired(true);
  registerSubsystem(useDatabase());
  registerSubsystem(useEvents());
  registerSubsystem(useTelegram());
  registerSubsystem(useService());
});

export const createHistorySyncRpcClient = module.createRpcClient;
export const createHistorySyncRpcRouter = module.createRpcRouter;
export const createHistorySyncServiceManifest = (
  config: Parameters<typeof module.createServiceManifest>[0]
) => module.createServiceManifest(config);
export type HistorySyncRouter = ReturnType<typeof createHistorySyncRpcRouter>;
export type HistorySyncRpcClient = ReturnType<typeof createHistorySyncRpcClient>;

export function runHistorySyncModule(options: HistorySyncServiceOptions): Promise<void> {
  return module.run(options);
}
