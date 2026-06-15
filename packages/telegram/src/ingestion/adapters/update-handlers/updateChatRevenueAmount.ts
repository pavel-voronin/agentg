import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatRevenueAmountChanges } from '../state.js';
import type { IngestionResources } from '../../resources.js';

type ChatRevenueAmountUpdate = UpdateByType<'updateChatRevenueAmount'>;

export async function handleUpdateChatRevenueAmount(
  update: ChatRevenueAmountUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatRevenueAmountChanges(update));
}
