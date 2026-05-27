import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { chatListKey } from '../telegram-store/chatListKey.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireUnreadChatCountUpdate = TelegramWireUpdateByType<'updateUnreadChatCount'>;

export async function handleUpdateUnreadChatCount(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireUnreadChatCountUpdate
): Promise<void> {
  await upsertTelegramKv(database, `unread_chat_count:${chatListKey(update.chat_list)}`, {
    total_count: update.total_count,
    unread_count: update.unread_count,
    unread_unmuted_count: update.unread_unmuted_count,
    marked_as_unread_count: update.marked_as_unread_count,
    marked_as_unread_unmuted_count: update.marked_as_unread_unmuted_count
  });

  events.publishTelegramUnreadChatCountUpdated(update);
}
