import { storeChatTheme } from '../../store/chatTheme.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatThemeUpdate = UpdateByType<'updateChatTheme'>;

export async function handleUpdateChatTheme(
  update: ChatThemeUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  const chatId = String(update.chat_id);
  const theme = update.theme ?? null;

  await storeChatTheme(database, chatId, theme);
  await files.recordChatThemeFiles(chatId, theme, 'live_update');
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
