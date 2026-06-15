import { chatListKey } from '../../store/chatListKey.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type UnreadChatCountUpdate = UpdateByType<'updateUnreadChatCount'>;

export async function handleUpdateUnreadChatCount(
  update: UnreadChatCountUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await upsertTelegramKv(database, `unread_chat_count:${chatListKey(update.chat_list)}`, {
    total_count: update.total_count,
    unread_count: update.unread_count,
    unread_unmuted_count: update.unread_unmuted_count,
    marked_as_unread_count: update.marked_as_unread_count,
    marked_as_unread_unmuted_count: update.marked_as_unread_unmuted_count
  });
}
