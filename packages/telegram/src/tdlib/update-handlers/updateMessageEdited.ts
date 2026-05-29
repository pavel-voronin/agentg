import { upsertTelegramMessageFragment } from '../../store/message.js';
import { telegramWireDate, telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireMessageEditedUpdate = TelegramWireUpdateByType<'updateMessageEdited'>;

export function handleUpdateMessageEdited(update: TelegramWireMessageEditedUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  return upsertTelegramMessageFragment(database, {
    chatId,
    editDate: telegramWireDate(update.edit_date),
    id: messageId,
    replyMarkup: telegramWireJsonValue(update.reply_markup ?? null)
  }).then(() => events.publishTelegramStoredMessageUpdated({ chatId, messageId }));
}
