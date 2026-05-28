import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramMessageFragment } from '../../store/message.js';
import { telegramWireDate, telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireMessageEditedUpdate = TelegramWireUpdateByType<'updateMessageEdited'>;

export function handleUpdateMessageEdited(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireMessageEditedUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  return upsertTelegramMessageFragment(context.database, {
    chatId,
    editDate: telegramWireDate(update.edit_date),
    id: messageId,
    replyMarkup: telegramWireJsonValue(update.reply_markup ?? null)
  }).then(() => context.events.publishTelegramStoredMessageUpdated({ chatId, messageId }));
}
