import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertStory } from '../telegram-store/story.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireStoryUpdate = TelegramWireUpdateByType<'updateStory'>;

export async function handleUpdateStory(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireStoryUpdate
): Promise<void> {
  const { events } = context;

  await upsertStory(context.database, update.story);
  await context.files.recordStoryFiles(update.story, 'live_update');
  events.publishTelegramStoryUpdated(update);
}
