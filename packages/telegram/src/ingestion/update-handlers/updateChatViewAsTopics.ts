import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatViewAsTopicsUpdate = UpdateByType<'updateChatViewAsTopics'>;

export async function handleUpdateChatViewAsTopics(
  update: ChatViewAsTopicsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    viewAsTopics: update.view_as_topics
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
