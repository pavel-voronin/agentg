import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatBusinessBotManageBarUpdate =
  TelegramWireUpdateByType<'updateChatBusinessBotManageBar'>;

export async function handleUpdateChatBusinessBotManageBar(
  update: TelegramWireChatBusinessBotManageBarUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    businessBotManageBar: telegramWireJsonValue(update.business_bot_manage_bar ?? null) ?? null,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
