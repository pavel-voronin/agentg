import { deleteStory, upsertStory } from '../../store/story.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireStoryPostSucceededUpdate = TelegramWireUpdateByType<'updateStoryPostSucceeded'>;

export async function handleUpdateStoryPostSucceeded(
  update: TelegramWireStoryPostSucceededUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  const posterChatId = String(update.story.poster_chat_id);

  await upsertStory(database, update.story);
  await files.recordStoryFiles(update.story, 'live_update');

  if (update.old_story_id !== update.story.id) {
    await files.deleteStoryFileSlots({ posterChatId, storyId: update.old_story_id });
    await deleteStory(database, { posterChatId, storyId: update.old_story_id });
  }

  events.publishTelegramStoryPostSucceeded(update);
}
