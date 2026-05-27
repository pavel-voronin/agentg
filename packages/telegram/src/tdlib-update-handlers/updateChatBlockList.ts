import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatBlockListUpdate = TelegramWireUpdateByType<'updateChatBlockList'>;

export async function handleUpdateChatBlockList(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatBlockListUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    blockList: telegramWireJsonValue(update.block_list ?? null) ?? null,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
