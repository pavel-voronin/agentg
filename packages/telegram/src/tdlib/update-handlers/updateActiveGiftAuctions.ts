import { storeGiftAuctionStates } from '../../store/giftAuctionState.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireActiveGiftAuctionsUpdate = TelegramWireUpdateByType<'updateActiveGiftAuctions'>;

export async function handleUpdateActiveGiftAuctions(
  update: TelegramWireActiveGiftAuctionsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await database.transaction(async (transaction) => {
    await storeGiftAuctionStates(transaction, update.states);
  });

  events.publishTelegramActiveGiftAuctionsUpdated(update);
}
