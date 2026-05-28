import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { storeMessage } from '../../store/message.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatReplyMarkupUpdate = TelegramWireUpdateByType<'updateChatReplyMarkup'>;

export async function handleUpdateChatReplyMarkup(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireChatReplyMarkupUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const replyMarkupMessage = update.reply_markup_message ?? null;

  await database.transaction(async (transaction) => {
    if (replyMarkupMessage !== null) {
      await storeMessage(transaction, replyMarkupMessage);
    }

    await upsertTelegramChatFragment(transaction, {
      id: chatId,
      replyMarkupMessageId: replyMarkupMessage === null ? null : String(replyMarkupMessage.id)
    });
  });

  if (replyMarkupMessage !== null) {
    await files.recordMessageFiles(replyMarkupMessage, 'live_update');
  }

  await events.publishTelegramChatDirectoryUpdated(chatId);
}
