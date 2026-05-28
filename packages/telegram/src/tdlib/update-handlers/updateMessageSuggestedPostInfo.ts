import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramMessageFragment } from '../../store/message.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireMessageSuggestedPostInfoUpdate =
  TelegramWireUpdateByType<'updateMessageSuggestedPostInfo'>;

export function handleUpdateMessageSuggestedPostInfo(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageSuggestedPostInfoUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  return upsertTelegramMessageFragment(database, {
    chatId,
    id: messageId,
    suggestedPostInfo: telegramWireJsonValue(update.suggested_post_info)
  }).then(() => events.publishTelegramStoredMessageUpdated({ chatId, messageId }));
}
