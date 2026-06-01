import { deleteMessages } from '../../store/message.js';
import type { DeleteMessagesUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateDeleteMessages(
  update: DeleteMessagesUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  if (update.from_cache || !update.is_permanent) {
    return;
  }

  const deletedAt = new Date();
  await deleteMessages(database, {
    chatId: String(update.chat_id),
    messageIds: update.message_ids.map(String)
  });

  await events.publishTelegramMessageDeleted({
    chatId: String(update.chat_id),
    deletedAt,
    fromCache: update.from_cache,
    isPermanent: update.is_permanent,
    messageIds: update.message_ids.map(String)
  });
}
