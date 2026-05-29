import { upsertStory } from '../../store/story.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireStoryPostFailedUpdate = TelegramWireUpdateByType<'updateStoryPostFailed'>;

export async function handleUpdateStoryPostFailed(
  update: TelegramWireStoryPostFailedUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  await upsertStory(database, update.story, {
    canPostStoryResult: update.error_type ?? null,
    error: update.error
  });
  await files.recordStoryFiles(update.story, 'live_update');
  events.publishTelegramStoryPostFailed(update);
}
