import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatDefaultDisableNotificationUpdate =
  TelegramWireUpdateByType<'updateChatDefaultDisableNotification'>;

export async function handleUpdateChatDefaultDisableNotification(
  update: TelegramWireChatDefaultDisableNotificationUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    defaultDisableNotification: update.default_disable_notification,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
