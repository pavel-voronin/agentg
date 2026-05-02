import { loadDatabaseCliConfig } from '@agentg/database/config';
import { checkDatabase, createDatabasePool } from '@agentg/database/database';

import { createHistoryDatabase } from './database.js';
import { runHistoryMigrations } from './migrate.js';

const config = loadDatabaseCliConfig();
const pool = createDatabasePool(config.databaseUrl);
const database = createHistoryDatabase(pool);

try {
  const databaseHealth = await checkDatabase(pool);

  console.log(
    JSON.stringify({
      event: 'history.database_healthcheck',
      postgres: {
        now: databaseHealth.now.toISOString(),
        version: databaseHealth.postgresVersion
      }
    })
  );

  await runHistoryMigrations(database);
  console.log(JSON.stringify({ event: 'history.database_migrated' }));
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'history.database_failed',
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
