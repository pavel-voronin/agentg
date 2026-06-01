import { upsertTelegramChatFragment } from '../../store/chat.js';
import { tdJsonValue, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatBlockListUpdate = UpdateByType<'updateChatBlockList'>;

export async function handleUpdateChatBlockList(
  update: ChatBlockListUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    blockList: tdJsonValue(update.block_list ?? null) ?? null,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
