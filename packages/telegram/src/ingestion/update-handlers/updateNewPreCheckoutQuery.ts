import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NewPreCheckoutQueryUpdate = UpdateByType<'updateNewPreCheckoutQuery'>;

export async function handleUpdateNewPreCheckoutQuery(
  update: NewPreCheckoutQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramPreCheckoutQueryReceived(update);
}
