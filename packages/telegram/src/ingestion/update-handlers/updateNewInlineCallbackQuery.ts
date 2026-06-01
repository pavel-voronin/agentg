import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NewInlineCallbackQueryUpdate = UpdateByType<'updateNewInlineCallbackQuery'>;

export async function handleUpdateNewInlineCallbackQuery(
  update: NewInlineCallbackQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramInlineCallbackQueryReceived(update);
}
