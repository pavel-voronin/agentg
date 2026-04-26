import { createAppDatabase } from './client.js';
import { loadDatabaseCliConfig } from './config.js';
import { checkDatabase, createDatabasePool } from './database.js';
import { runDatabaseMigrations } from './migrate.js';

const config = loadDatabaseCliConfig();
const pool = createDatabasePool(config.databaseUrl);
const database = createAppDatabase(pool);

try {
  const databaseHealth = await checkDatabase(pool);

  console.log(
    JSON.stringify({
      event: 'database.healthcheck',
      postgres: {
        now: databaseHealth.now.toISOString(),
        version: databaseHealth.postgresVersion
      }
    })
  );

  await runDatabaseMigrations(database);
  console.log(JSON.stringify({ event: 'database.migrated' }));
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'database.failed',
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
