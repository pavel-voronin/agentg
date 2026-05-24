import { chatFoldersUpdatedEventInput, replaceChatFolders } from '../telegram-store/chatFolders.js';
import type { TelegramWireChatFoldersUpdate } from '../telegramWire.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';

export async function handleUpdateChatFolders(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatFoldersUpdate
): Promise<void> {
  await replaceChatFolders(database, update);
  events.publishTelegramChatFoldersUpdated(chatFoldersUpdatedEventInput(update));
}
