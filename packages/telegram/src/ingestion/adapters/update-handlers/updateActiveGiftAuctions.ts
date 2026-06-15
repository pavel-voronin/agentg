import { applyIngestionChanges } from '../../applyChanges.js';
import { activeGiftAuctionsChanges } from '../giftAuction.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ActiveGiftAuctionsUpdate = UpdateByType<'updateActiveGiftAuctions'>;

export async function handleUpdateActiveGiftAuctions(
  update: ActiveGiftAuctionsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, activeGiftAuctionsChanges(update));
}
