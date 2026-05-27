import type { TelegramDatabase } from '../database.js';
import { telegramChatBoosts } from '../schema.js';
import { telegramWireJsonObject, type TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatBoostUpdate = TelegramWireUpdateByType<'updateChatBoost'>;

export async function storeChatBoost(
  database: TelegramDatabase,
  update: TelegramWireChatBoostUpdate
): Promise<void> {
  const row = chatBoostRow(update);

  await database
    .insert(telegramChatBoosts)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramChatBoosts.chatId, telegramChatBoosts.id]
    });
}

function chatBoostRow(update: TelegramWireChatBoostUpdate): typeof telegramChatBoosts.$inferInsert {
  const boost = update.boost;

  return {
    chatId: String(update.chat_id),
    count: boost.count,
    expirationDate: unixDate(boost.expiration_date),
    id: boost.id,
    source: telegramWireJsonObject(boost.source),
    startDate: unixDate(boost.start_date)
  };
}

function unixDate(value: number): Date {
  return new Date(value * 1000);
}
