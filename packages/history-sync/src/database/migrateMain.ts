import { createLogger, logError } from '@agentg/framework';

import { readDatabaseConfig } from '../config.js';

import { createDatabase } from './client.js';

const config = readDatabaseConfig(process.env);
const database = createDatabase(config.databaseUrl);
const logger = createLogger('history-sync');

try {
  await database.start();
  logger.info({ event: 'history-sync.database_migrated' }, 'history sync database migrated');
} catch (error) {
  logger.error(
    {
      event: 'history-sync.database_failed',
      ...logError(error)
    },
    'history sync database migration failed'
  );
  process.exitCode = 1;
} finally {
  await database.stop();
}
