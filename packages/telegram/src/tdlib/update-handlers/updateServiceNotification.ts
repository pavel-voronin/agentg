import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireServiceNotificationUpdate = TelegramWireUpdateByType<'updateServiceNotification'>;

export function handleUpdateServiceNotification(
  update: TelegramWireServiceNotificationUpdate
): Promise<void> {
  const events = useUpdateEvents();
  events.publishTelegramServiceNotificationReceived(update);
  return Promise.resolve();
}
