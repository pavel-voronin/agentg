import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireHavePendingNotificationsUpdate =
  TelegramWireUpdateByType<'updateHavePendingNotifications'>;

export function handleUpdateHavePendingNotifications(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireHavePendingNotificationsUpdate
): void {
  events.publishTelegramPendingNotificationsUpdated(update);
}
