import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { storeChatNotificationSettings } from '../../store/chat.js';
import type { TelegramWireChatNotificationSettingsUpdate } from '../wire.js';

export async function handleUpdateChatNotificationSettings(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatNotificationSettingsUpdate
): Promise<void> {
  await storeChatNotificationSettings(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
