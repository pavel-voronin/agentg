import { storeGiftAuctionStates } from '../../store/giftAuctionState.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type GiftAuctionStateUpdate = UpdateByType<'updateGiftAuctionState'>;

export async function handleUpdateGiftAuctionState(
  update: GiftAuctionStateUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await database.transaction(async (transaction) => {
    await storeGiftAuctionStates(transaction, [update.state]);
  });

  await events.publishTelegramGiftAuctionStateUpdated(update);
}
