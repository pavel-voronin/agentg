import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatDefaultDisableNotificationUpdate =
  TelegramWireUpdateByType<'updateChatDefaultDisableNotification'>;

export async function handleUpdateChatDefaultDisableNotification(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatDefaultDisableNotificationUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    defaultDisableNotification: update.default_disable_notification,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
