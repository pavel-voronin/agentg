import { telegramManagedBots } from '../../database/schema.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireManagedBotUpdate = TelegramWireUpdateByType<'updateManagedBot'>;

export async function handleUpdateManagedBot(update: TelegramWireManagedBotUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const row = {
    botUserId: String(update.bot_user_id),
    creatorUserId: String(update.user_id)
  } satisfies typeof telegramManagedBots.$inferInsert;

  await database.insert(telegramManagedBots).values(row).onConflictDoUpdate({
    set: row,
    target: telegramManagedBots.botUserId
  });

  events.publishTelegramManagedBotUpdated({
    botUserId: row.botUserId,
    creatorUserId: row.creatorUserId
  });
}
