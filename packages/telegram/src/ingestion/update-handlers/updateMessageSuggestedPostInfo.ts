import { upsertTelegramMessageFragment } from '../../store/message.js';
import { tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type MessageSuggestedPostInfoUpdate = UpdateByType<'updateMessageSuggestedPostInfo'>;

export function handleUpdateMessageSuggestedPostInfo(
  update: MessageSuggestedPostInfoUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  return upsertTelegramMessageFragment(database, {
    chatId,
    id: messageId,
    suggestedPostInfo: tdJsonValue(update.suggested_post_info)
  });
}
