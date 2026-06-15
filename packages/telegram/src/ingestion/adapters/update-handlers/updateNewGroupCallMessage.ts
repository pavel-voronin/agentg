import { applyIngestionChanges } from '../../applyChanges.js';
import { newGroupCallMessageChanges } from '../runtimeState.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type NewGroupCallMessageUpdate = UpdateByType<'updateNewGroupCallMessage'>;

export async function handleUpdateNewGroupCallMessage(
  update: NewGroupCallMessageUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, newGroupCallMessageChanges(update));
}
