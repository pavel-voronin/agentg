import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { storeGiftAuctionStates } from '../../store/giftAuctionState.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireGiftAuctionStateUpdate = TelegramWireUpdateByType<'updateGiftAuctionState'>;

export async function handleUpdateGiftAuctionState(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireGiftAuctionStateUpdate
): Promise<void> {
  await database.transaction(async (transaction) => {
    await storeGiftAuctionStates(transaction, [update.state]);
  });

  events.publishTelegramGiftAuctionStateUpdated(update);
}
