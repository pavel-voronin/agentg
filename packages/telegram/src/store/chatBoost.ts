import type { Database } from '../database/client.js';
import { telegramChatBoosts } from '../database/schema.js';
import { tdJsonObject, type UpdateByType } from '../tdlib/value.js';

type ChatBoostUpdate = UpdateByType<'updateChatBoost'>;

export async function storeChatBoost(database: Database, update: ChatBoostUpdate): Promise<void> {
  const row = chatBoostRow(update);

  await database
    .insert(telegramChatBoosts)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramChatBoosts.chatId, telegramChatBoosts.id]
    });
}

function chatBoostRow(update: ChatBoostUpdate): typeof telegramChatBoosts.$inferInsert {
  const boost = update.boost;

  return {
    chatId: String(update.chat_id),
    count: boost.count,
    expirationDate: unixDate(boost.expiration_date),
    id: boost.id,
    source: tdJsonObject(boost.source),
    startDate: unixDate(boost.start_date)
  };
}

function unixDate(value: number): Date {
  return new Date(value * 1000);
}
