import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type PaidMediaPurchasedUpdate = UpdateByType<'updatePaidMediaPurchased'>;

export function handleUpdatePaidMediaPurchased(
  update: PaidMediaPurchasedUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
