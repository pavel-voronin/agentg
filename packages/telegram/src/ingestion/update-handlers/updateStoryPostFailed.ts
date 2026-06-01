import { upsertStory } from '../../store/story.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type StoryPostFailedUpdate = UpdateByType<'updateStoryPostFailed'>;

export async function handleUpdateStoryPostFailed(
  update: StoryPostFailedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  await upsertStory(database, update.story, {
    canPostStoryResult: update.error_type ?? null,
    error: update.error
  });
  await files.recordStoryFiles(update.story, 'live_update');
  await events.publishTelegramStoryPostFailed(update);
}
