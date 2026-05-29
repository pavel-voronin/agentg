import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireHavePendingNotificationsUpdate =
  TelegramWireUpdateByType<'updateHavePendingNotifications'>;

export function handleUpdateHavePendingNotifications(
  update: TelegramWireHavePendingNotificationsUpdate
): void {
  const events = useUpdateEvents();
  events.publishTelegramPendingNotificationsUpdated(update);
}
