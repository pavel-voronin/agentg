import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireSpeedLimitNotificationUpdate =
  TelegramWireUpdateByType<'updateSpeedLimitNotification'>;

export function handleUpdateSpeedLimitNotification(
  update: TelegramWireSpeedLimitNotificationUpdate
): Promise<void> {
  const events = useUpdateEvents();
  events.publishTelegramSpeedLimitNotificationReceived(update);
  return Promise.resolve();
}
