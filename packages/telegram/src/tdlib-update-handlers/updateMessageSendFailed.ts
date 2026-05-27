import { and, eq } from 'drizzle-orm';

import { TELEGRAM_MESSAGE_MODEL, telegramMessageModelId } from '../modelRefs.js';
import { telegramFileSlots, telegramMessageReactions, telegramMessages } from '../schema.js';
import { recordMessageFiles, storeMessage } from '../telegram-store/message.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { telegramWireJsonObject, type TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireMessageSendFailedUpdate = TelegramWireUpdateByType<'updateMessageSendFailed'>;

export async function handleUpdateMessageSendFailed(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageSendFailedUpdate
): Promise<void> {
  const chatId = String(update.message.chat_id);
  const messageId = String(update.message.id);
  const oldMessageId = String(update.old_message_id);

  await database.transaction(async (transaction) => {
    await storeMessage(transaction, update.message);

    if (oldMessageId === messageId) {
      return;
    }

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

  await recordMessageFiles(files, update.message, 'live_update');

  events.publishTelegramMessageSendFailed({
    chatId,
    error: telegramWireJsonObject(update.error),
    messageId,
    oldMessageId
  });
}
