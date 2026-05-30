import type { EventBus } from '@agentg/events/bus';
import {
  defineControlPlane,
  defineModule,
  defineEvents,
  defineProcedures,
  registerSubsystem,
  setRequired
} from '@agentg/framework';
import type { Module } from '@agentg/framework';

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

const procedures = {
  deleteTarget,
  getChatHistorySyncState,
  requestSync,
  upsertTarget
};

type ProcedureResources = {
  database: HistorySyncDatabase;
  eventBus: EventBus;
  requestSync?: (reason: string, chatId?: string) => void;
  telegram?: TelegramReadClient;
};

type HistorySyncModule = Module<
  ProcedureResources,
  ProcedureResources,
  typeof procedures,
  HistorySyncControlPlane,
  HistorySyncServiceOptions
>;

export const historySyncModule: HistorySyncModule = defineModule('history-sync', () => {
  defineControlPlane(new HistorySyncControlPlaneSubsystem());
  defineEvents(EVENT_TYPES);
  defineProcedures(procedures);
  setRequired(true);
  registerSubsystem(useDatabase());
  registerSubsystem(useEvents());
  registerSubsystem(useTelegram());
  registerSubsystem(useService());
});

export function runHistorySyncModule(options: HistorySyncServiceOptions): Promise<void> {
  return historySyncModule.run(options);
}
