import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { storeGiftAuctionStates } from '../../store/giftAuctionState.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireActiveGiftAuctionsUpdate = TelegramWireUpdateByType<'updateActiveGiftAuctions'>;

export async function handleUpdateActiveGiftAuctions(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireActiveGiftAuctionsUpdate
): Promise<void> {
  await database.transaction(async (transaction) => {
    await storeGiftAuctionStates(transaction, update.states);
  });

  events.publishTelegramActiveGiftAuctionsUpdated(update);
}
