import { applyIngestionChanges } from '../../applyChanges.js';
import { groupCallChanges } from '../runtimeState.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type GroupCallUpdate = UpdateByType<'updateGroupCall'>;

export async function handleUpdateGroupCall(
  update: GroupCallUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, groupCallChanges(update));
}
