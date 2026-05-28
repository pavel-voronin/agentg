import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { chatListKey } from '../../store/chatListKey.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireUnreadMessageCountUpdate = TelegramWireUpdateByType<'updateUnreadMessageCount'>;

export async function handleUpdateUnreadMessageCount(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireUnreadMessageCountUpdate
): Promise<void> {
  await upsertTelegramKv(database, `unread_message_count:${chatListKey(update.chat_list)}`, {
    unread_count: update.unread_count,
    unread_unmuted_count: update.unread_unmuted_count
  });

  events.publishTelegramUnreadMessageCountUpdated(update);
}
