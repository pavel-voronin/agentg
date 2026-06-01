import { upsertTelegramChatFragment } from '../../store/chat.js';
import { tdJsonValue, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatVideoChatUpdate = UpdateByType<'updateChatVideoChat'>;

export async function handleUpdateChatVideoChat(
  update: ChatVideoChatUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    videoChat: tdJsonValue(update.video_chat) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
