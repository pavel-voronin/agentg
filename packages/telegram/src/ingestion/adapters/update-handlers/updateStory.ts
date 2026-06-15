import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { storyFileSlots } from '../fileSlot.js';
import { storyChanges } from '../story.js';
import type { IngestionResources } from '../../resources.js';

type StoryUpdate = UpdateByType<'updateStory'>;

export async function handleUpdateStory(
  update: StoryUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;

  await applyIngestionChanges(resources, storyChanges(update));
  await files.recordFileSlots(storyFileSlots(update.story), 'live_update');
}
