import { storeChatBackground } from '../../store/chatBackground.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireChatBackgroundUpdate = TelegramWireUpdateByType<'updateChatBackground'>;

export async function handleUpdateChatBackground(
  update: TelegramWireChatBackgroundUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  const chatId = String(update.chat_id);
  const background = update.background ?? null;

  await storeChatBackground(database, chatId, background);
  if (background !== null) {
    await files.recordChatBackgroundFiles(chatId, background, 'live_update');
  }
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
