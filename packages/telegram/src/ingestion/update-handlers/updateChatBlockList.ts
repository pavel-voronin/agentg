import { upsertTelegramChatFragment } from '../../store/chat.js';
import { tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatBlockListUpdate = UpdateByType<'updateChatBlockList'>;

export async function handleUpdateChatBlockList(
  update: ChatBlockListUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    blockList: tdJsonValue(update.block_list ?? null) ?? null,
    id: chatId
  });
}
