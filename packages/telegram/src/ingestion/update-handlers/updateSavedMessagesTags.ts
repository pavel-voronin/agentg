import { replaceSavedMessagesTags } from '../../store/savedMessages.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type SavedMessagesTagsUpdate = UpdateByType<'updateSavedMessagesTags'>;

export async function handleUpdateSavedMessagesTags(
  update: SavedMessagesTagsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await replaceSavedMessagesTags(database, update);
}
