import { and, eq } from 'drizzle-orm';

import { TELEGRAM_MESSAGE_MODEL, telegramMessageModelId } from '../../model/refs.js';
import {
  telegramFileSlots,
  telegramMessageReactions,
  telegramMessages
} from '../../database/schema.js';
import { recordMessageFiles, storeMessage } from '../../store/message.js';
import { telegramWireJsonObject, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireMessageSendFailedUpdate = TelegramWireUpdateByType<'updateMessageSendFailed'>;

export async function handleUpdateMessageSendFailed(
  update: TelegramWireMessageSendFailedUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
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
