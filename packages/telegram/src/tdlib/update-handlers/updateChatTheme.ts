import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { storeChatTheme } from '../../store/chatTheme.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatThemeUpdate = TelegramWireUpdateByType<'updateChatTheme'>;

export async function handleUpdateChatTheme(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireChatThemeUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const theme = update.theme ?? null;

  await storeChatTheme(database, chatId, theme);
  await files.recordChatThemeFiles(chatId, theme, 'live_update');
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
