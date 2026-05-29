import { chatListKey } from '../../store/chatListKey.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireUnreadMessageCountUpdate = TelegramWireUpdateByType<'updateUnreadMessageCount'>;

export async function handleUpdateUnreadMessageCount(
  update: TelegramWireUnreadMessageCountUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await upsertTelegramKv(database, `unread_message_count:${chatListKey(update.chat_list)}`, {
    unread_count: update.unread_count,
    unread_unmuted_count: update.unread_unmuted_count
  });

  events.publishTelegramUnreadMessageCountUpdated(update);
}
