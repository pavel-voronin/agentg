import { applyIngestionChanges } from '../../applyChanges.js';
import { messageSuggestedPostInfoChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageSuggestedPostInfoUpdate = UpdateByType<'updateMessageSuggestedPostInfo'>;

export async function handleUpdateMessageSuggestedPostInfo(
  update: MessageSuggestedPostInfoUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, messageSuggestedPostInfoChanges(update));
}
