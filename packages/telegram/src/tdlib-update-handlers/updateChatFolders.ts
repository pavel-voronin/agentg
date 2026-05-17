import { chatFoldersUpdatedEventInput, replaceChatFolders } from '../telegram-store/ChatFolders.js';
import type { TelegramWireChatFoldersUpdate } from '../telegram-wire.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateChatFolders(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatFoldersUpdate
): Promise<void> {
  await replaceChatFolders(database, update);
  events.publishTelegramChatFoldersUpdated(chatFoldersUpdatedEventInput(update));
}
