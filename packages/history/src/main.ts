import { checkDatabase, createDatabasePool } from '@agentg/database/database';
import { createNatsEventBus } from '@agentg/events/bus';

import { loadHistoryServiceConfig } from './config.js';
import { createHistoryDatabase } from './database.js';
import { runHistoryService } from './service.js';

const config = loadHistoryServiceConfig();
const pool = createDatabasePool(config.databaseUrl);
const database = createHistoryDatabase(pool);

try {
  const databaseHealth = await checkDatabase(pool);
  console.log(
    JSON.stringify({
      event: 'history.startup_healthcheck',
      postgres: {
        now: databaseHealth.now.toISOString(),
        version: databaseHealth.postgresVersion
      }
    })
  );

  const eventBus = await createNatsEventBus(config.nats);
  await runHistoryService({
    backfill: config.backfill,
    database,
    eventBus,
    internalRpc: config.internalRpc,
    serviceRpcUrl: config.serviceRpcUrl,
    services: config.services
  });
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'history.failed',
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
