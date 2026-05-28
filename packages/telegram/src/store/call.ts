import type { TelegramDatabase } from '../database/client.js';
import { telegramCalls } from '../database/schema.js';
import { telegramWireJsonObject, type TelegramWireUpdateByType } from '../tdlib/wire.js';

type TelegramWireCall = TelegramWireUpdateByType<'updateCall'>['call'];

export async function storeCall(database: TelegramDatabase, call: TelegramWireCall): Promise<void> {
  const row: typeof telegramCalls.$inferInsert = {
    id: call.id,
    isOutgoing: call.is_outgoing,
    isVideo: call.is_video,
    state: telegramWireJsonObject(call.state),
    uniqueId: call.unique_id,
    userId: String(call.user_id)
  };

  await database.insert(telegramCalls).values(row).onConflictDoUpdate({
    set: row,
    target: telegramCalls.id
  });
}
