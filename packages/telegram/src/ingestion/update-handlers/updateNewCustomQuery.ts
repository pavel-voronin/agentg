import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NewCustomQueryUpdate = UpdateByType<'updateNewCustomQuery'>;

export async function handleUpdateNewCustomQuery(
  update: NewCustomQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramCustomQueryReceived(update);
}
