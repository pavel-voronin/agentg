import { upsertTelegramChatFragment } from '../../store/chat.js';
import { storeMessage } from '../../store/message.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatReplyMarkupUpdate = UpdateByType<'updateChatReplyMarkup'>;

export async function handleUpdateChatReplyMarkup(
  update: ChatReplyMarkupUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
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
