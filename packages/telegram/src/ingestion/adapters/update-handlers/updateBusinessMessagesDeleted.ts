import { applyIngestionChanges } from '../../applyChanges.js';
import { deletedBusinessMessagesChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type BusinessMessagesDeletedUpdate = UpdateByType<'updateBusinessMessagesDeleted'>;

export async function handleUpdateBusinessMessagesDeleted(
  update: BusinessMessagesDeletedUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, deletedBusinessMessagesChanges(update));
}
