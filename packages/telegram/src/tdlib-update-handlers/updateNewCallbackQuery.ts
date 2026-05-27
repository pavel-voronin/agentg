import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireNewCallbackQueryUpdate = TelegramWireUpdateByType<'updateNewCallbackQuery'>;

export function handleUpdateNewCallbackQuery(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewCallbackQueryUpdate
): void {
  events.publishTelegramCallbackQueryReceived(update);
}
