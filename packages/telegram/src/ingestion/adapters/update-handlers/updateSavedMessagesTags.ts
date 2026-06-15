import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { savedMessagesTagsChanges } from '../topic.js';
import type { IngestionResources } from '../../resources.js';

type SavedMessagesTagsUpdate = UpdateByType<'updateSavedMessagesTags'>;

export async function handleUpdateSavedMessagesTags(
  update: SavedMessagesTagsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, savedMessagesTagsChanges(update));
}
