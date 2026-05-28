import { replaceChatFolders } from '../../store/chatFolders.js';
import type { TelegramWireChatFoldersUpdate } from '../wire.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';

export async function handleUpdateChatFolders(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatFoldersUpdate
): Promise<void> {
  await replaceChatFolders(database, update);
  events.publishTelegramChatFoldersUpdated(update);
}
