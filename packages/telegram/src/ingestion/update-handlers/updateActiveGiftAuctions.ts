import { storeGiftAuctionStates } from '../../store/giftAuctionState.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ActiveGiftAuctionsUpdate = UpdateByType<'updateActiveGiftAuctions'>;

export async function handleUpdateActiveGiftAuctions(
  update: ActiveGiftAuctionsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await database.transaction(async (transaction) => {
    await storeGiftAuctionStates(transaction, update.states);
  });
}
