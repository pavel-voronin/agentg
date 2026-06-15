import { storeGiftAuctionStates } from '../../store/giftAuctionState.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type GiftAuctionStateUpdate = UpdateByType<'updateGiftAuctionState'>;

export async function handleUpdateGiftAuctionState(
  update: GiftAuctionStateUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await database.transaction(async (transaction) => {
    await storeGiftAuctionStates(transaction, [update.state]);
  });
}
