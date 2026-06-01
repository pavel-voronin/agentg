import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatIsTranslatableUpdate = UpdateByType<'updateChatIsTranslatable'>;

export async function handleUpdateChatIsTranslatable(
  update: ChatIsTranslatableUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    isTranslatable: update.is_translatable
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
