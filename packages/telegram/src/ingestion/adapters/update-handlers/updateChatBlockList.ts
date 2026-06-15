import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatBlockListChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatBlockListUpdate = UpdateByType<'updateChatBlockList'>;

export async function handleUpdateChatBlockList(
  update: ChatBlockListUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatBlockListChanges(update));
}
