import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NewCallbackQueryUpdate = UpdateByType<'updateNewCallbackQuery'>;

export async function handleUpdateNewCallbackQuery(
  update: NewCallbackQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramCallbackQueryReceived(update);
}
