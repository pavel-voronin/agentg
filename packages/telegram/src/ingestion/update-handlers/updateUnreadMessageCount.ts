import { chatListKey } from '../../store/chatListKey.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type UnreadMessageCountUpdate = UpdateByType<'updateUnreadMessageCount'>;

export async function handleUpdateUnreadMessageCount(
  update: UnreadMessageCountUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await upsertTelegramKv(database, `unread_message_count:${chatListKey(update.chat_list)}`, {
    unread_count: update.unread_count,
    unread_unmuted_count: update.unread_unmuted_count
  });

  await events.publishTelegramUnreadMessageCountUpdated(update);
}
