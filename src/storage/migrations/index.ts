import { historyDomainMigration } from '../../history/migrations.js';
import { historyTargetsMigration } from '../../history/targetMigrations.js';
import { summariesPluginMigration } from '../../plugins/summaries/migrations.js';
import { telegramChatListMembershipsMigration } from '../../telegram/chatListMigrations.js';
import { telegramDomainMigration } from '../../telegram/migrations.js';
import { storageMigrationsMigration } from './0001_storage_migrations.js';
import type { SqliteMigration } from './types.js';

export const sqliteMigrations: readonly SqliteMigration[] = [
  storageMigrationsMigration,
  telegramDomainMigration,
  historyDomainMigration,
  summariesPluginMigration,
  historyTargetsMigration,
  telegramChatListMembershipsMigration
];
