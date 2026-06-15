import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { storyFileSlots } from '../fileSlot.js';
import { deletedStoryChanges, savedStoryChanges } from '../story.js';
import type { IngestionResources } from '../../resources.js';

type StoryPostSucceededUpdate = UpdateByType<'updateStoryPostSucceeded'>;

export async function handleUpdateStoryPostSucceeded(
  update: StoryPostSucceededUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  const posterChatId = String(update.story.poster_chat_id);

  await applyIngestionChanges(resources, savedStoryChanges(update.story));
  await files.recordFileSlots(storyFileSlots(update.story), 'live_update');

  if (update.old_story_id !== update.story.id) {
    await files.deleteStoryFileSlots({ posterChatId, storyId: update.old_story_id });
    await applyIngestionChanges(
      resources,
      deletedStoryChanges({ posterChatId, storyId: update.old_story_id })
    );
  }
}
