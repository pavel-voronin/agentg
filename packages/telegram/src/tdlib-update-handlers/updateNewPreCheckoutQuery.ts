import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireNewPreCheckoutQueryUpdate = TelegramWireUpdateByType<'updateNewPreCheckoutQuery'>;

export function handleUpdateNewPreCheckoutQuery(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewPreCheckoutQueryUpdate
): void {
  events.publishTelegramPreCheckoutQueryReceived(update);
}
