import { storeChatPosition } from '../../store/chat.js';
import type { TelegramWireChatPositionUpdate } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

export async function handleUpdateChatPosition(
  update: TelegramWireChatPositionUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await storeChatPosition(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
