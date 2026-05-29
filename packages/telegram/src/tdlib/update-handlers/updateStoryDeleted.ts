import { deleteStory } from '../../store/story.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireStoryDeletedUpdate = TelegramWireUpdateByType<'updateStoryDeleted'>;

export function handleUpdateStoryDeleted(update: TelegramWireStoryDeletedUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  const posterChatId = String(update.story_poster_chat_id);

  return files
    .deleteStoryFileSlots({ posterChatId, storyId: update.story_id })
    .then(() => deleteStory(database, { posterChatId, storyId: update.story_id }))
    .then(() => events.publishTelegramStoryDeleted(update));
}
