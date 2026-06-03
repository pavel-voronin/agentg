import { readConfig } from '../config.js';

import { createDatabase } from './client.js';

const config = readConfig(process.env);
const database = createDatabase(config.databaseUrl);

try {
  await database.start();
  console.log(JSON.stringify({ event: 'history-sync.database_migrated' }));
} catch (error) {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'history-sync.database_failed'
    })
  );
  process.exitCode = 1;
} finally {
  await database.stop();
}
