import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireNewCustomEventUpdate = TelegramWireUpdateByType<'updateNewCustomEvent'>;

export function handleUpdateNewCustomEvent(update: TelegramWireNewCustomEventUpdate): void {
  const events = useUpdateEvents();
  events.publishTelegramCustomEventReceived(update);
}
