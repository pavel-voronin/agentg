import { chatListKey } from '../kv.js';
import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type UnreadMessageCountUpdate = UpdateByType<'updateUnreadMessageCount'>;

export async function handleUpdateUnreadMessageCount(
  update: UnreadMessageCountUpdate,
  resources: IngestionResources
): Promise<void> {
  await saveKvEntry(resources, `unread_message_count:${chatListKey(update.chat_list)}`, {
    unread_count: update.unread_count,
    unread_unmuted_count: update.unread_unmuted_count
  });
}
