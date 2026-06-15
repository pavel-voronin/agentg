import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { storyFileSlots } from '../fileSlot.js';
import { storyPostFailedChanges } from '../story.js';
import type { IngestionResources } from '../../resources.js';

type StoryPostFailedUpdate = UpdateByType<'updateStoryPostFailed'>;

export async function handleUpdateStoryPostFailed(
  update: StoryPostFailedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(resources, storyPostFailedChanges(update));
  await files.recordFileSlots(storyFileSlots(update.story), 'live_update');
}
