import { upsertStory } from '../../store/story.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useFiles } from '../../files/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireStoryUpdate = TelegramWireUpdateByType<'updateStory'>;

export async function handleUpdateStory(update: TelegramWireStoryUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();

  await upsertStory(database, update.story);
  await files.recordStoryFiles(update.story, 'live_update');
  events.publishTelegramStoryUpdated(update);
}
