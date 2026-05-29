import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatIsMarkedAsUnreadUpdate =
  TelegramWireUpdateByType<'updateChatIsMarkedAsUnread'>;

export async function handleUpdateChatIsMarkedAsUnread(
  update: TelegramWireChatIsMarkedAsUnreadUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    isMarkedAsUnread: update.is_marked_as_unread
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
