import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type PaidMediaPurchasedUpdate = UpdateByType<'updatePaidMediaPurchased'>;

export async function handleUpdatePaidMediaPurchased(
  update: PaidMediaPurchasedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { events } = resources;
  await events.publishTelegramPaidMediaPurchased(update);
}
