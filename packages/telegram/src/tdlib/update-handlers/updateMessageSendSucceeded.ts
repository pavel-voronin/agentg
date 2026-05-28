import { and, eq } from 'drizzle-orm';

import { TELEGRAM_MESSAGE_MODEL, telegramMessageModelId } from '../../model/refs.js';
import {
  telegramFileSlots,
  telegramMessageReactions,
  telegramMessages
} from '../../database/schema.js';
import {
  recordMessageFiles,
  replaceMessageReactionSummaries,
  storeMessage
} from '../../store/message.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireMessageSendSucceededUpdate =
  TelegramWireUpdateByType<'updateMessageSendSucceeded'>;

export async function handleUpdateMessageSendSucceeded(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageSendSucceededUpdate
): Promise<void> {
  const chatId = String(update.message.chat_id);
  const messageId = String(update.message.id);
  const oldMessageId = String(update.old_message_id);

  await database.transaction(async (transaction) => {
    await storeMessage(transaction, update.message);

    await replaceMessageReactionSummaries(transaction, {
      chatId,
      messageId,
      reactions: update.message.interaction_info?.reactions?.reactions ?? []
    });

    await transaction
      .update(telegramMessages)
      .set({ sendAcknowledged: null })
      .where(and(eq(telegramMessages.chatId, chatId), eq(telegramMessages.id, messageId)));
  });

  await recordMessageFiles(files, update.message, 'live_update');

  if (oldMessageId !== messageId) {
    await database.transaction(async (transaction) => {
      await transaction
        .delete(telegramFileSlots)
        .where(
          and(
            eq(telegramFileSlots.ownerModel, TELEGRAM_MESSAGE_MODEL),
            eq(telegramFileSlots.ownerId, telegramMessageModelId(chatId, oldMessageId))
          )
        );

      await transaction
        .delete(telegramMessageReactions)
        .where(
          and(
            eq(telegramMessageReactions.chatId, chatId),
            eq(telegramMessageReactions.messageId, oldMessageId)
          )
        );

      await transaction
        .delete(telegramMessages)
        .where(and(eq(telegramMessages.chatId, chatId), eq(telegramMessages.id, oldMessageId)));
    });
  }

  events.publishTelegramMessageSendSucceeded({
    chatId,
    message: update.message,
    messageId,
    oldMessageId
  });
}
