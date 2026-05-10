import { checkDatabase, createDatabasePool } from '@agentg/database/database';
import { createNatsEventBus } from '@agentg/events/bus';

import { loadHistorySyncServiceConfig } from './config.js';
import { createHistorySyncDatabase } from './database.js';
import { runHistorySyncService } from './service.js';

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
  await runHistorySyncService({
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
