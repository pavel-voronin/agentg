import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireServiceNotificationUpdate = TelegramWireUpdateByType<'updateServiceNotification'>;

export function handleUpdateServiceNotification(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireServiceNotificationUpdate
): Promise<void> {
  context.events.publishTelegramServiceNotificationReceived(update);
  return Promise.resolve();
}
