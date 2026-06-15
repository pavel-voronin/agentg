import { upsertTelegramChatFragment } from '../../store/chat.js';
import { tdId, type UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatReadOutboxUpdate = UpdateByType<'updateChatReadOutbox'>;

export async function handleUpdateChatReadOutbox(
  update: ChatReadOutboxUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    lastReadOutboxMessageId: tdId(update.last_read_outbox_message_id)
  });
}
