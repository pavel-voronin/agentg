import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { storeChatNotificationSettings } from '../telegram-store/chat.js';
import type { TelegramWireChatNotificationSettingsUpdate } from '../telegramWire.js';

export async function handleUpdateChatNotificationSettings(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatNotificationSettingsUpdate
): Promise<void> {
  await storeChatNotificationSettings(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
