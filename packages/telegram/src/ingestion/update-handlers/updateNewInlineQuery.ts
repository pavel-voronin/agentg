import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NewInlineQueryUpdate = UpdateByType<'updateNewInlineQuery'>;

export async function handleUpdateNewInlineQuery(
  update: NewInlineQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramInlineQueryReceived(update);
}
