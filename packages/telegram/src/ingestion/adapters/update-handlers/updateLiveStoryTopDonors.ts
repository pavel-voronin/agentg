import { applyIngestionChanges } from '../../applyChanges.js';
import { liveStoryTopDonorsChanges } from '../runtimeState.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type LiveStoryTopDonorsUpdate = UpdateByType<'updateLiveStoryTopDonors'>;

export async function handleUpdateLiveStoryTopDonors(
  update: LiveStoryTopDonorsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, liveStoryTopDonorsChanges(update));
}
