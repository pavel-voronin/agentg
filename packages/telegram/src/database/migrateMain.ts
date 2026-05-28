import { loadDatabaseCliConfig } from '@agentg/database/config';
import { checkDatabase, createDatabasePool } from '@agentg/database/database';

import { createTelegramDatabase } from './client.js';
import { runTelegramMigrations } from './migrate.js';

const config = loadDatabaseCliConfig();
const pool = createDatabasePool(config.databaseUrl);
const database = createTelegramDatabase(pool);

try {
  const databaseHealth = await checkDatabase(pool);

  console.log(
    JSON.stringify({
      event: 'telegram.database_healthcheck',
      postgres: {
        now: databaseHealth.now.toISOString(),
        version: databaseHealth.postgresVersion
      }
    })
  );

  await runTelegramMigrations(database);
  console.log(JSON.stringify({ event: 'telegram.database_migrated' }));
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'telegram.database_failed',
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
