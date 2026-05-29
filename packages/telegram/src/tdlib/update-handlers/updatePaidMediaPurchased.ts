import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWirePaidMediaPurchasedUpdate = TelegramWireUpdateByType<'updatePaidMediaPurchased'>;

export function handleUpdatePaidMediaPurchased(update: TelegramWirePaidMediaPurchasedUpdate): void {
  const events = useUpdateEvents();
  events.publishTelegramPaidMediaPurchased(update);
}
