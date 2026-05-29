import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatPermissionsUpdate = TelegramWireUpdateByType<'updateChatPermissions'>;

export async function handleUpdateChatPermissions(
  update: TelegramWireChatPermissionsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    permissions: telegramWireJsonValue(update.permissions) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
