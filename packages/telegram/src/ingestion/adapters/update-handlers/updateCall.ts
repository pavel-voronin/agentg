import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { callChanges } from '../call.js';
import type { IngestionResources } from '../../resources.js';

type CallUpdate = UpdateByType<'updateCall'>;

export async function handleUpdateCall(
  update: CallUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, callChanges(update));
}
