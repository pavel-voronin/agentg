import { storeChatTheme } from '../../store/chatTheme.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireChatThemeUpdate = TelegramWireUpdateByType<'updateChatTheme'>;

export async function handleUpdateChatTheme(update: TelegramWireChatThemeUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  const chatId = String(update.chat_id);
  const theme = update.theme ?? null;

  await storeChatTheme(database, chatId, theme);
  await files.recordChatThemeFiles(chatId, theme, 'live_update');
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
