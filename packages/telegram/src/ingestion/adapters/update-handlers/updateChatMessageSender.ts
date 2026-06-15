import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatMessageSenderChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatMessageSenderUpdate = UpdateByType<'updateChatMessageSender'>;

export async function handleUpdateChatMessageSender(
  update: ChatMessageSenderUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatMessageSenderChanges(update));
}
