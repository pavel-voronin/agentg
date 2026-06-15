import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatBoostChanges } from '../state.js';
import type { IngestionResources } from '../../resources.js';

type ChatBoostUpdate = UpdateByType<'updateChatBoost'>;

export async function handleUpdateChatBoost(
  update: ChatBoostUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatBoostChanges(update));
}
