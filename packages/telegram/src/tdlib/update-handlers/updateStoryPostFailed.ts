import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertStory } from '../../store/story.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireStoryPostFailedUpdate = TelegramWireUpdateByType<'updateStoryPostFailed'>;

export async function handleUpdateStoryPostFailed(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireStoryPostFailedUpdate
): Promise<void> {
  await upsertStory(context.database, update.story, {
    canPostStoryResult: update.error_type ?? null,
    error: update.error
  });
  await context.files.recordStoryFiles(update.story, 'live_update');
  context.events.publishTelegramStoryPostFailed(update);
}
