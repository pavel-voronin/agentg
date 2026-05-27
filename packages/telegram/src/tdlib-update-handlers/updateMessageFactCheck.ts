import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramMessageFragment } from '../telegram-store/message.js';
import { telegramWireJsonValue } from '../telegramWire.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

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
