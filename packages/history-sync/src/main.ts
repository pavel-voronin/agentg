import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkDatabase, createDatabasePool } from '@agentg/database/database';
import type { EventBus } from '@agentg/events/bus';
import { createNatsEventBus } from '@agentg/events/bus';
import {
  defineControlPlane,
  defineDomain,
  defineEvents,
  defineProcedures,
  defineSubsystem,
  registerSubsystem,
  setRequired
} from '@agentg/framework/domain';

import {
  HistorySyncControlPlaneSubsystem,
  type HistorySyncControlPlane
} from './control-plane/subsystem.js';
import type { HistorySyncDatabase } from './database.js';
import { deleteTarget } from './rpc/deleteTarget.js';
import { getChatHistorySyncState } from './rpc/getChatHistorySyncState.js';
import { requestSync } from './rpc/requestSync.js';
import { upsertTarget } from './rpc/upsertTarget.js';
import type { HistorySyncServiceOptions } from './service/runService.js';
import { HistorySyncServiceSubsystem } from './service/subsystem.js';
import type { TelegramReadClient } from './telegramClient.js';
import { loadHistorySyncServiceConfig } from './config.js';
import { createHistorySyncDatabase } from './database.js';

export const HISTORY_SYNC_EVENT_TYPES = [
  'history-sync.sync.accepted',
  'history-sync.sync.completed',
  'history-sync.sync.failed',
  'history-sync.sync.requested',
  'history-sync.sync.started',
  'history-sync.target.auto_deleted',
  'history-sync.target.deleted',
  'history-sync.target.upserted'
] as const;

export type HistorySyncDomainContext = {
  database: HistorySyncDatabase;
  eventBus: EventBus;
  requestSync?: (reason: string, chatId?: string) => void;
  telegram?: TelegramReadClient;
};

const historySyncProcedures = {
  deleteTarget,
  getChatHistorySyncState,
  requestSync,
  upsertTarget
};

const useHistorySyncService = defineSubsystem('service', () => new HistorySyncServiceSubsystem());

const historySync = defineDomain<
  HistorySyncDomainContext,
  HistorySyncDomainContext,
  typeof historySyncProcedures,
  HistorySyncControlPlane,
  HistorySyncServiceOptions
>('history-sync', () => {
  defineControlPlane(new HistorySyncControlPlaneSubsystem());
  defineEvents(HISTORY_SYNC_EVENT_TYPES);
  defineProcedures(historySyncProcedures);
  setRequired(true);
  const service = useHistorySyncService();
  registerSubsystem(service);
});

export const createHistorySyncRpcClient = historySync.createRpcClient;
export const createHistorySyncRpcRouter = historySync.createRpcRouter;
export const createHistorySyncServiceManifest = (
  config: Parameters<typeof historySync.createServiceManifest>[0]
) => historySync.createServiceManifest(config);
export type HistorySyncRouter = ReturnType<typeof createHistorySyncRpcRouter>;
export type HistorySyncRpcClient = ReturnType<typeof createHistorySyncRpcClient>;

if (isMainModule()) {
  await runHistorySyncMain();
}

async function runHistorySyncMain(): Promise<void> {
  const config = loadHistorySyncServiceConfig();
  const pool = createDatabasePool(config.databaseUrl);
  const database = createHistorySyncDatabase(pool);

  try {
    const databaseHealth = await checkDatabase(pool);
    console.log(
      JSON.stringify({
        event: 'history-sync.startup_healthcheck',
        postgres: {
          now: databaseHealth.now.toISOString(),
          version: databaseHealth.postgresVersion
        }
      })
    );

    const eventBus = await createNatsEventBus(config.nats);
    await historySync.run({
      database,
      eventBus,
      internalRpc: config.internalRpc,
      serviceRpcUrl: config.serviceRpcUrl,
      services: config.services,
      sync: config.sync
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'history-sync.failed',
        error: error instanceof Error ? error.message : String(error)
      })
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

function isMainModule(): boolean {
  return (
    process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])
  );
}
