import { deleteStory, upsertStory } from '../../store/story.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type StoryPostSucceededUpdate = UpdateByType<'updateStoryPostSucceeded'>;

export async function handleUpdateStoryPostSucceeded(
  update: StoryPostSucceededUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  const posterChatId = String(update.story.poster_chat_id);

  await upsertStory(database, update.story);
  await files.recordStoryFiles(update.story, 'live_update');

  if (update.old_story_id !== update.story.id) {
    await files.deleteStoryFileSlots({ posterChatId, storyId: update.old_story_id });
    await deleteStory(database, { posterChatId, storyId: update.old_story_id });
  }
}
