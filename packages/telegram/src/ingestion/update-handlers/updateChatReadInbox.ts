import { upsertTelegramChatFragment } from '../../store/chat.js';
import { tdId, type UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatReadInboxUpdate = UpdateByType<'updateChatReadInbox'>;

export async function handleUpdateChatReadInbox(
  update: ChatReadInboxUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    lastReadInboxMessageId: tdId(update.last_read_inbox_message_id),
    unreadCount: update.unread_count
  });
}
