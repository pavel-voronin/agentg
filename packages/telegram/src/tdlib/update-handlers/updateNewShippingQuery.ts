import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireNewShippingQueryUpdate = TelegramWireUpdateByType<'updateNewShippingQuery'>;

export function handleUpdateNewShippingQuery(update: TelegramWireNewShippingQueryUpdate): void {
  const events = useUpdateEvents();
  events.publishTelegramShippingQueryReceived(update);
}
