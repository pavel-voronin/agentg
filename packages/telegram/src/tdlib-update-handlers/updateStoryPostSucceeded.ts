import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { deleteStory, upsertStory } from '../telegram-store/story.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireStoryPostSucceededUpdate = TelegramWireUpdateByType<'updateStoryPostSucceeded'>;

export async function handleUpdateStoryPostSucceeded(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireStoryPostSucceededUpdate
): Promise<void> {
  const posterChatId = String(update.story.poster_chat_id);

  await upsertStory(database, update.story);
  await files.recordStoryFiles(update.story, 'live_update');

  if (update.old_story_id !== update.story.id) {
    await files.deleteStoryFileSlots({ posterChatId, storyId: update.old_story_id });
    await deleteStory(database, { posterChatId, storyId: update.old_story_id });
  }

  events.publishTelegramStoryPostSucceeded(update);
}
