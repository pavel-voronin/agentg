import { applyIngestionChanges } from '../../applyChanges.js';
import { activeLiveLocationMessageSetChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ActiveLiveLocationMessagesUpdate = UpdateByType<'updateActiveLiveLocationMessages'>;

export async function handleUpdateActiveLiveLocationMessages(
  update: ActiveLiveLocationMessagesUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, activeLiveLocationMessageSetChanges(update));
}
