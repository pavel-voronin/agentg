import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatViewAsTopicsChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatViewAsTopicsUpdate = UpdateByType<'updateChatViewAsTopics'>;

export async function handleUpdateChatViewAsTopics(
  update: ChatViewAsTopicsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatViewAsTopicsChanges(update));
}
