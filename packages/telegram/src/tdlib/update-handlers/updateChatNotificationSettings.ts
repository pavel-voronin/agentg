import { storeChatNotificationSettings } from '../../store/chat.js';
import type { TelegramWireChatNotificationSettingsUpdate } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

export async function handleUpdateChatNotificationSettings(
  update: TelegramWireChatNotificationSettingsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await storeChatNotificationSettings(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
