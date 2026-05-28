import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { deleteStory } from '../../store/story.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireStoryDeletedUpdate = TelegramWireUpdateByType<'updateStoryDeleted'>;

export function handleUpdateStoryDeleted(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireStoryDeletedUpdate
): Promise<void> {
  const posterChatId = String(update.story_poster_chat_id);

  return context.files
    .deleteStoryFileSlots({ posterChatId, storyId: update.story_id })
    .then(() => deleteStory(context.database, { posterChatId, storyId: update.story_id }))
    .then(() => context.events.publishTelegramStoryDeleted(update));
}
