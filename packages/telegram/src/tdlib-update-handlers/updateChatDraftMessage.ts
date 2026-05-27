import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import {
  replaceTelegramChatPositions,
  upsertTelegramChatFragment
} from '../telegram-store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatDraftMessageUpdate = TelegramWireUpdateByType<'updateChatDraftMessage'>;

export async function handleUpdateChatDraftMessage(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatDraftMessageUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await database.transaction(async (transaction) => {
    await upsertTelegramChatFragment(transaction, {
      draftMessage: telegramWireJsonValue(update.draft_message ?? null) ?? null,
      id: chatId
    });
    await replaceTelegramChatPositions(transaction, chatId, update.positions);
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
