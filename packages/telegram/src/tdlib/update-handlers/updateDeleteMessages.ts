import { deleteMessages } from '../../store/message.js';
import type { TelegramWireDeleteMessagesUpdate } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

export async function handleUpdateDeleteMessages(
  update: TelegramWireDeleteMessagesUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  if (update.from_cache || !update.is_permanent) {
    return;
  }

  const deletedAt = new Date();
  await deleteMessages(database, {
    chatId: String(update.chat_id),
    messageIds: update.message_ids.map(String)
  });

  events.publishTelegramMessageDeleted({
    chatId: String(update.chat_id),
    deletedAt,
    fromCache: update.from_cache,
    isPermanent: update.is_permanent,
    messageIds: update.message_ids.map(String)
  });
}
