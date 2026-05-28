import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { storeChatBackground } from '../../store/chatBackground.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatBackgroundUpdate = TelegramWireUpdateByType<'updateChatBackground'>;

export async function handleUpdateChatBackground(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireChatBackgroundUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const background = update.background ?? null;

  await storeChatBackground(database, chatId, background);
  if (background !== null) {
    await files.recordChatBackgroundFiles(chatId, background, 'live_update');
  }
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
