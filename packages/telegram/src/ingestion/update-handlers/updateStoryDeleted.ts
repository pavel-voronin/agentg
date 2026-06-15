import { deleteStory } from '../../store/story.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type StoryDeletedUpdate = UpdateByType<'updateStoryDeleted'>;

export function handleUpdateStoryDeleted(
  update: StoryDeletedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  const posterChatId = String(update.story_poster_chat_id);

  return files
    .deleteStoryFileSlots({ posterChatId, storyId: update.story_id })
    .then(() => deleteStory(database, { posterChatId, storyId: update.story_id }));
}
