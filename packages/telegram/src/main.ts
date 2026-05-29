import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkDatabase, createDatabasePool } from '@agentg/database/database';
import { createNatsEventBus } from '@agentg/events/bus';

import { loadTelegramIngestionConfig } from './config.js';
import { createTelegramDatabase } from './database/client.js';
import { configureTdlib } from './tdlib/client.js';
import { runTelegramModule } from './module.js';

if (isMainModule()) {
  await runTelegramMain();
}

async function runTelegramMain(): Promise<void> {
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
    await runTelegramModule({
      database,
      eventBus,
      internalRpc: config.internalRpc,
      serviceRpcUrl: config.serviceRpcUrl,
      services: config.services,
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
}

function isMainModule(): boolean {
  return (
    process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])
  );
}
