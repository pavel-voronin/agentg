import { createLogger, logError } from '@agentg/framework';

import { readDatabaseConfig } from '../config.js';

import { createDatabase } from './client.js';

const config = readDatabaseConfig(process.env);
const database = createDatabase(config.databaseUrl);
const logger = createLogger('telegram');

try {
  await database.start();
  logger.info({ event: 'telegram.database_migrated' }, 'telegram database migrated');
} catch (error) {
  logger.error(
    {
      event: 'telegram.database_failed',
      ...logError(error)
    },
    'telegram database migration failed'
  );
  process.exitCode = 1;
} finally {
  await database.stop();
}
