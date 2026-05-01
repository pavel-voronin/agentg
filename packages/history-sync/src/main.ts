import { createAppDatabase } from '@agentg/database/client';
import { checkDatabase, createDatabasePool } from '@agentg/database/database';
import { createNatsEventBus } from '@agentg/shared/events/bus';

import { loadHistorySyncServiceConfig } from './config.js';
import { runHistorySyncService } from './service.js';

const config = loadHistorySyncServiceConfig();
const pool = createDatabasePool(config.databaseUrl);
const database = createAppDatabase(pool);

try {
  const databaseHealth = await checkDatabase(pool);
  console.log(
    JSON.stringify({
      event: 'history_sync.startup_healthcheck',
      postgres: {
        now: databaseHealth.now.toISOString(),
        version: databaseHealth.postgresVersion
      }
    })
  );

  const eventBus = await createNatsEventBus(config.nats);
  await runHistorySyncService({
    backfill: config.backfill,
    database,
    eventBus
  });
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'history_sync.failed',
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
