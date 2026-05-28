import { telegramManagedBots } from '../../schema.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireManagedBotUpdate = TelegramWireUpdateByType<'updateManagedBot'>;

export async function handleUpdateManagedBot(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireManagedBotUpdate
): Promise<void> {
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
