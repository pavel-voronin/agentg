import { telegramManagedBots } from '../../database/schema.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ManagedBotUpdate = UpdateByType<'updateManagedBot'>;

export async function handleUpdateManagedBot(
  update: ManagedBotUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const row = {
    botUserId: String(update.bot_user_id),
    creatorUserId: String(update.user_id)
  } satisfies typeof telegramManagedBots.$inferInsert;

  await database.insert(telegramManagedBots).values(row).onConflictDoUpdate({
    set: row,
    target: telegramManagedBots.botUserId
  });
}
