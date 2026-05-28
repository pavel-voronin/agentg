import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireSpeedLimitNotificationUpdate =
  TelegramWireUpdateByType<'updateSpeedLimitNotification'>;

export function handleUpdateSpeedLimitNotification(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireSpeedLimitNotificationUpdate
): Promise<void> {
  context.events.publishTelegramSpeedLimitNotificationReceived(update);
  return Promise.resolve();
}
