import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramMessageFragment } from '../../store/message.js';
import { telegramWireJsonValue } from '../wire.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireMessageFactCheckUpdate = TelegramWireUpdateByType<'updateMessageFactCheck'>;

export function handleUpdateMessageFactCheck(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageFactCheckUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  return upsertTelegramMessageFragment(database, {
    chatId,
    factCheck: telegramWireJsonValue(update.fact_check),
    id: messageId
  }).then(() => events.publishTelegramStoredMessageUpdated({ chatId, messageId }));
}
