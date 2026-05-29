import { upsertTelegramMessageFragment } from '../../store/message.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireMessageSuggestedPostInfoUpdate =
  TelegramWireUpdateByType<'updateMessageSuggestedPostInfo'>;

export function handleUpdateMessageSuggestedPostInfo(
  update: TelegramWireMessageSuggestedPostInfoUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  return upsertTelegramMessageFragment(database, {
    chatId,
    id: messageId,
    suggestedPostInfo: telegramWireJsonValue(update.suggested_post_info)
  }).then(() => events.publishTelegramStoredMessageUpdated({ chatId, messageId }));
}
