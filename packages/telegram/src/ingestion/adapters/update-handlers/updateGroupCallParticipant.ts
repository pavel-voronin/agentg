import { applyIngestionChanges } from '../../applyChanges.js';
import { groupCallParticipantChanges } from '../runtimeState.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type GroupCallParticipantUpdate = UpdateByType<'updateGroupCallParticipant'>;

export async function handleUpdateGroupCallParticipant(
  update: GroupCallParticipantUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, groupCallParticipantChanges(update));
}
