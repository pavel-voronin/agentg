import type { SqliteMigration } from '../storage/migrations/types.js';

export const telegramDropChatListProjectionMigration: SqliteMigration = {
  id: '0011',
  name: 'telegram_drop_chat_list_projection',
  up(database): void {
    database.exec(`
      DROP INDEX IF EXISTS telegram_chat_list_memberships_order_idx;
      DROP INDEX IF EXISTS telegram_chat_list_memberships_list_idx;
      DROP TABLE IF EXISTS telegram_chat_list_memberships;
    `);
  }
};
