import { applyIngestionChanges } from '../../applyChanges.js';
import { giftAuctionStateChanges } from '../giftAuction.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type GiftAuctionStateUpdate = UpdateByType<'updateGiftAuctionState'>;

export async function handleUpdateGiftAuctionState(
  update: GiftAuctionStateUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, giftAuctionStateChanges(update));
}
