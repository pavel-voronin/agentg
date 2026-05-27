import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireNewShippingQueryUpdate = TelegramWireUpdateByType<'updateNewShippingQuery'>;

export function handleUpdateNewShippingQuery(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewShippingQueryUpdate
): void {
  events.publishTelegramShippingQueryReceived(update);
}
