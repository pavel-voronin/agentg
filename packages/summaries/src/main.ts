import { checkDatabase, createDatabasePool } from '@agentg/database/database';
import { createNatsEventBus } from '@agentg/shared/events/bus';

import { loadSummariesServiceConfig } from './config.js';
import { createSummariesDatabase } from './database.js';
import { runSummariesService } from './service.js';

const config = loadSummariesServiceConfig();
const pool = createDatabasePool(config.databaseUrl);
const database = createSummariesDatabase(pool);

try {
  const databaseHealth = await checkDatabase(pool);
  console.log(
    JSON.stringify({
      event: 'summaries.startup_healthcheck',
      postgres: {
        now: databaseHealth.now.toISOString(),
        version: databaseHealth.postgresVersion
      }
    })
  );

  const eventBus = await createNatsEventBus(config.nats);
  await runSummariesService({
    config,
    database,
    eventBus
  });
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'summaries.failed',
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
