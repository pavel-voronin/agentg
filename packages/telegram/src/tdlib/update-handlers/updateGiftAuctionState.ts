import { storeGiftAuctionStates } from '../../store/giftAuctionState.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireGiftAuctionStateUpdate = TelegramWireUpdateByType<'updateGiftAuctionState'>;

export async function handleUpdateGiftAuctionState(
  update: TelegramWireGiftAuctionStateUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await database.transaction(async (transaction) => {
    await storeGiftAuctionStates(transaction, [update.state]);
  });

  events.publishTelegramGiftAuctionStateUpdated(update);
}
