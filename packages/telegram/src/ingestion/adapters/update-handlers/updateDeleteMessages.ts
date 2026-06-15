import { applyIngestionChanges } from '../../applyChanges.js';
import { deletedMessagesChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type DeleteMessagesUpdate = UpdateByType<'updateDeleteMessages'>;

export async function handleUpdateDeleteMessages(
  update: DeleteMessagesUpdate,
  resources: IngestionResources
): Promise<void> {
  if (update.from_cache || !update.is_permanent) {
    return;
  }

  await applyIngestionChanges(resources, deletedMessagesChanges(update));
}
