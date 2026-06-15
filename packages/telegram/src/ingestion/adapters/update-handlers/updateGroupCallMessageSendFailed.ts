import { applyIngestionChanges } from '../../applyChanges.js';
import { groupCallMessageSendFailedChanges } from '../runtimeState.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type GroupCallMessageSendFailedUpdate = UpdateByType<'updateGroupCallMessageSendFailed'>;

export async function handleUpdateGroupCallMessageSendFailed(
  update: GroupCallMessageSendFailedUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, groupCallMessageSendFailedChanges(update));
}
