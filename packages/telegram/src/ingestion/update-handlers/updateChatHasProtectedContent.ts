import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatHasProtectedContentUpdate = UpdateByType<'updateChatHasProtectedContent'>;

export async function handleUpdateChatHasProtectedContent(
  update: ChatHasProtectedContentUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    hasProtectedContent: update.has_protected_content,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
