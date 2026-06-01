import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NewShippingQueryUpdate = UpdateByType<'updateNewShippingQuery'>;

export async function handleUpdateNewShippingQuery(
  update: NewShippingQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramShippingQueryReceived(update);
}
