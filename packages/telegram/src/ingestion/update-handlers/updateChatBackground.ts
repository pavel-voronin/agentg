import { storeChatBackground } from '../../store/chatBackground.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatBackgroundUpdate = UpdateByType<'updateChatBackground'>;

export async function handleUpdateChatBackground(
  update: ChatBackgroundUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  const chatId = String(update.chat_id);
  const background = update.background ?? null;

  await storeChatBackground(database, chatId, background);
  if (background !== null) {
    await files.recordChatBackgroundFiles(chatId, background, 'live_update');
  }
}
