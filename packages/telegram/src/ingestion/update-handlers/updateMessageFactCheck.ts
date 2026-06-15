import { upsertTelegramMessageFragment } from '../../store/message.js';
import { tdJsonValue } from '../../tdlib/shape.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type MessageFactCheckUpdate = UpdateByType<'updateMessageFactCheck'>;

export function handleUpdateMessageFactCheck(
  update: MessageFactCheckUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  return upsertTelegramMessageFragment(database, {
    chatId,
    factCheck: tdJsonValue(update.fact_check),
    id: messageId
  });
}
