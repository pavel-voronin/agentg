import { applyIngestionChanges } from '../../applyChanges.js';
import { groupCallMessagesDeletedChanges } from '../runtimeState.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type GroupCallMessagesDeletedUpdate = UpdateByType<'updateGroupCallMessagesDeleted'>;

export async function handleUpdateGroupCallMessagesDeleted(
  update: GroupCallMessagesDeletedUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, groupCallMessagesDeletedChanges(update));
}
