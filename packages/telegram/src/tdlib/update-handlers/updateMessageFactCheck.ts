import { upsertTelegramMessageFragment } from '../../store/message.js';
import { telegramWireJsonValue } from '../wire.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireMessageFactCheckUpdate = TelegramWireUpdateByType<'updateMessageFactCheck'>;

export function handleUpdateMessageFactCheck(
  update: TelegramWireMessageFactCheckUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  return upsertTelegramMessageFragment(database, {
    chatId,
    factCheck: telegramWireJsonValue(update.fact_check),
    id: messageId
  }).then(() => events.publishTelegramStoredMessageUpdated({ chatId, messageId }));
}
