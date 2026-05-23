import { loadDatabaseCliConfig } from '@agentg/database/config';
import { checkDatabase, createDatabasePool } from '@agentg/database/database';

import { createHistorySyncDatabase } from './database.js';
import { runHistorySyncMigrations } from './migrate.js';

const config = loadDatabaseCliConfig();
const pool = createDatabasePool(config.databaseUrl);
const database = createHistorySyncDatabase(pool);

try {
  const databaseHealth = await checkDatabase(pool);

  console.log(
    JSON.stringify({
      event: 'history-sync.database_healthcheck',
      postgres: {
        now: databaseHealth.now.toISOString(),
        version: databaseHealth.postgresVersion
      }
    })
  );

  await runHistorySyncMigrations(database);
  console.log(JSON.stringify({ event: 'history-sync.database_migrated' }));
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'history-sync.database_failed',
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
