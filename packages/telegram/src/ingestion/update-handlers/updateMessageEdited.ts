import { upsertTelegramMessageFragment } from '../../store/message.js';
import { tdDate, tdJsonValue, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type MessageEditedUpdate = UpdateByType<'updateMessageEdited'>;

export function handleUpdateMessageEdited(
  update: MessageEditedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  return upsertTelegramMessageFragment(database, {
    chatId,
    editDate: tdDate(update.edit_date),
    id: messageId,
    replyMarkup: tdJsonValue(update.reply_markup ?? null)
  }).then(() => events.publishTelegramStoredMessageUpdated({ chatId, messageId }));
}
