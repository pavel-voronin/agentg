import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { storeGiftAuctionStates } from '../telegram-store/giftAuctionState.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

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
