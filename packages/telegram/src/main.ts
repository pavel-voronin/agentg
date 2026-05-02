import { checkDatabase, createDatabasePool } from '@agentg/database/database';
import { createNatsEventBus } from '@agentg/shared/events/bus';

import { loadTelegramIngestionConfig } from './config.js';
import { createTelegramDatabase } from './database.js';
import { runTelegramIngestion } from './ingestion.js';
import { configureTdlib } from './tdlib.js';

const config = loadTelegramIngestionConfig();
const pool = createDatabasePool(config.databaseUrl);
const database = createTelegramDatabase(pool);

try {
  const databaseHealth = await checkDatabase(pool);
  const tdlibStatus = configureTdlib();

  console.log(
    JSON.stringify({
      event: 'telegram_ingestion.startup_healthcheck',
      postgres: {
        now: databaseHealth.now.toISOString(),
        version: databaseHealth.postgresVersion
      },
      tdlib: {
        tdjsonPath: tdlibStatus.tdjsonPath
      }
    })
  );

  const eventBus = await createNatsEventBus(config.nats);
  await runTelegramIngestion({
    database,
    eventBus,
    internalRpc: config.internalRpc,
    telegram: config.telegram
  });
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'telegram_ingestion.failed',
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
