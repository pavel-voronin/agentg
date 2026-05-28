import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatIsMarkedAsUnreadUpdate =
  TelegramWireUpdateByType<'updateChatIsMarkedAsUnread'>;

export async function handleUpdateChatIsMarkedAsUnread(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatIsMarkedAsUnreadUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    isMarkedAsUnread: update.is_marked_as_unread
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
