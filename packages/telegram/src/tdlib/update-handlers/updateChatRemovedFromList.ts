import { removeChatListMembership } from '../../store/chatListMembership.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatRemovedFromListUpdate = TelegramWireUpdateByType<'updateChatRemovedFromList'>;

export async function handleUpdateChatRemovedFromList(
  update: TelegramWireChatRemovedFromListUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await removeChatListMembership(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
