import { applyIngestionChanges } from '../../applyChanges.js';
import { groupCallVerificationStateChanges } from '../runtimeState.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type GroupCallVerificationStateUpdate = UpdateByType<'updateGroupCallVerificationState'>;

export async function handleUpdateGroupCallVerificationState(
  update: GroupCallVerificationStateUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, groupCallVerificationStateChanges(update));
}
