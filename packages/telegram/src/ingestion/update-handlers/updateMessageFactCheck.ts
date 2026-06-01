import { upsertTelegramMessageFragment } from '../../store/message.js';
import { tdJsonValue } from '../types.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type MessageFactCheckUpdate = UpdateByType<'updateMessageFactCheck'>;

export function handleUpdateMessageFactCheck(
  update: MessageFactCheckUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  return upsertTelegramMessageFragment(database, {
    chatId,
    factCheck: tdJsonValue(update.fact_check),
    id: messageId
  }).then(() => events.publishTelegramStoredMessageUpdated({ chatId, messageId }));
}
