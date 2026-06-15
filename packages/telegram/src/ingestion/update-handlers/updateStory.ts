import { upsertStory } from '../../store/story.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type StoryUpdate = UpdateByType<'updateStory'>;

export async function handleUpdateStory(
  update: StoryUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;

  await upsertStory(database, update.story);
  await files.recordStoryFiles(update.story, 'live_update');
}
