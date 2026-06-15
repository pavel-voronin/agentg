import { applyIngestionChanges } from '../../applyChanges.js';
import { updatedMessageStateChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageIsPinnedUpdate = UpdateByType<'updateMessageIsPinned'>;

export async function handleUpdateMessageIsPinned(
  update: MessageIsPinnedUpdate,
  resources: IngestionResources
): Promise<void> {
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await applyIngestionChanges(
    resources,
    updatedMessageStateChanges({
      chatId,
      id: messageId,
      isPinned: update.is_pinned
    })
  );
}
