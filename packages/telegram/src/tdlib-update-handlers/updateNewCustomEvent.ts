import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireNewCustomEventUpdate = TelegramWireUpdateByType<'updateNewCustomEvent'>;

export function handleUpdateNewCustomEvent(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewCustomEventUpdate
): void {
  events.publishTelegramCustomEventReceived(update);
}
