import { applyIngestionChanges } from '../../applyChanges.js';
import { messageMentionReadChatChanges } from '../chat.js';
import { updatedMessageStateChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageMentionReadUpdate = UpdateByType<'updateMessageMentionRead'>;

export async function handleUpdateMessageMentionRead(
  update: MessageMentionReadUpdate,
  resources: IngestionResources
): Promise<void> {
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await applyIngestionChanges(resources, [
    ...updatedMessageStateChanges({
      chatId,
      containsUnreadMention: false,
      id: messageId
    }),
    ...messageMentionReadChatChanges(update)
  ]);
}
