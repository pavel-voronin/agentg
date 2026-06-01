import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatIsMarkedAsUnreadUpdate = UpdateByType<'updateChatIsMarkedAsUnread'>;

export async function handleUpdateChatIsMarkedAsUnread(
  update: ChatIsMarkedAsUnreadUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    isMarkedAsUnread: update.is_marked_as_unread
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
