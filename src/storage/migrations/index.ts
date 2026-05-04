import { historyDomainMigration } from '../../history/migrations.js';
import { historyBackfillMigration } from '../../history/backfillMigrations.js';
import { historyPruneCompletedJobsMigration } from '../../history/jobPruneMigrations.js';
import { historyTargetsMigration } from '../../history/targetMigrations.js';
import { summariesPluginMigration } from '../../plugins/summaries/migrations.js';
import { telegramDropChatListProjectionMigration } from '../../telegram/dropChatListProjectionMigration.js';
import { telegramDomainMigration } from '../../telegram/migrations.js';
import { storageMigrationsMigration } from './0001_storage_migrations.js';
import type { SqliteMigration } from './types.js';

export const sqliteMigrations: readonly SqliteMigration[] = [
  storageMigrationsMigration,
  telegramDomainMigration,
  historyDomainMigration,
  summariesPluginMigration,
  historyTargetsMigration,
  historyBackfillMigration,
  historyPruneCompletedJobsMigration,
  telegramDropChatListProjectionMigration
];
