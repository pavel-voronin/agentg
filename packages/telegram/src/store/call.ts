import type { Database } from '../database/client.js';
import { telegramCalls } from '../database/schema.js';
import { tdJsonObject, type UpdateByType } from '../tdlib/value.js';

type Call = UpdateByType<'updateCall'>['call'];

export async function storeCall(database: Database, call: Call): Promise<void> {
  const row: typeof telegramCalls.$inferInsert = {
    id: call.id,
    isOutgoing: call.is_outgoing,
    isVideo: call.is_video,
    state: tdJsonObject(call.state),
    uniqueId: call.unique_id,
    userId: String(call.user_id)
  };

  await database.insert(telegramCalls).values(row).onConflictDoUpdate({
    set: row,
    target: telegramCalls.id
  });
}
