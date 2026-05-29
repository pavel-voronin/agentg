import { storeChatListMembership } from '../../store/chatListMembership.js';
import type { TelegramWireChatAddedToListUpdate } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

export async function handleUpdateChatAddedToList(
  update: TelegramWireChatAddedToListUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await storeChatListMembership(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
