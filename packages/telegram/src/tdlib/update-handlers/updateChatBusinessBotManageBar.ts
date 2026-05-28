import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatBusinessBotManageBarUpdate =
  TelegramWireUpdateByType<'updateChatBusinessBotManageBar'>;

export async function handleUpdateChatBusinessBotManageBar(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatBusinessBotManageBarUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    businessBotManageBar: telegramWireJsonValue(update.business_bot_manage_bar ?? null) ?? null,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
