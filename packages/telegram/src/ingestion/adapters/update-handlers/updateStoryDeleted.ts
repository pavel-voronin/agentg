import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { storyDeletedChanges } from '../story.js';
import type { IngestionResources } from '../../resources.js';

type StoryDeletedUpdate = UpdateByType<'updateStoryDeleted'>;

export function handleUpdateStoryDeleted(
  update: StoryDeletedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  const posterChatId = String(update.story_poster_chat_id);

  return files
    .deleteStoryFileSlots({ posterChatId, storyId: update.story_id })
    .then(() => applyIngestionChanges(resources, storyDeletedChanges(update)))
    .then(() => undefined);
}
