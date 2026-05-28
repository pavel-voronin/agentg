import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

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
