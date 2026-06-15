import { applyIngestionChanges } from '../../applyChanges.js';
import { groupCallParticipantsChanges } from '../runtimeState.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type GroupCallParticipantsUpdate = UpdateByType<'updateGroupCallParticipants'>;

export async function handleUpdateGroupCallParticipants(
  update: GroupCallParticipantsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, groupCallParticipantsChanges(update));
}
