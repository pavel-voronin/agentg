import { replaceChatFolders } from '../../store/chatFolders.js';
import type { TelegramWireChatFoldersUpdate } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

export async function handleUpdateChatFolders(
  update: TelegramWireChatFoldersUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await replaceChatFolders(database, update);
  events.publishTelegramChatFoldersUpdated(update);
}
