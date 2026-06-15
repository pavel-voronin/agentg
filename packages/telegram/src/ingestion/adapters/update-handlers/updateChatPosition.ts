import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatPositionChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatPositionUpdate = UpdateByType<'updateChatPosition'>;

export async function handleUpdateChatPosition(
  update: ChatPositionUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatPositionChanges(update));
}
