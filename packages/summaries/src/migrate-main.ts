import { loadDatabaseCliConfig } from '@agentg/database/config';
import { checkDatabase, createDatabasePool } from '@agentg/database/database';

import { createSummariesDatabase } from './database.js';
import { runSummariesMigrations } from './migrate.js';

const config = loadDatabaseCliConfig();
const pool = createDatabasePool(config.databaseUrl);
const database = createSummariesDatabase(pool);

try {
  const databaseHealth = await checkDatabase(pool);

  console.log(
    JSON.stringify({
      event: 'summaries.database_healthcheck',
      postgres: {
        now: databaseHealth.now.toISOString(),
        version: databaseHealth.postgresVersion
      }
    })
  );

  await runSummariesMigrations(database);
  console.log(JSON.stringify({ event: 'summaries.database_migrated' }));
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'summaries.database_failed',
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
