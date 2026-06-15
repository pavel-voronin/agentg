import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatHasScheduledMessagesChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatHasScheduledMessagesUpdate = UpdateByType<'updateChatHasScheduledMessages'>;

export async function handleUpdateChatHasScheduledMessages(
  update: ChatHasScheduledMessagesUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatHasScheduledMessagesChanges(update));
}
