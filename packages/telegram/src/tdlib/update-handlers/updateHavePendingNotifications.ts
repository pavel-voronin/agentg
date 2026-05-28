import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireHavePendingNotificationsUpdate =
  TelegramWireUpdateByType<'updateHavePendingNotifications'>;

export function handleUpdateHavePendingNotifications(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireHavePendingNotificationsUpdate
): void {
  events.publishTelegramPendingNotificationsUpdated(update);
}
