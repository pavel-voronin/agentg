import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireNewInlineCallbackQueryUpdate =
  TelegramWireUpdateByType<'updateNewInlineCallbackQuery'>;

export function handleUpdateNewInlineCallbackQuery(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewInlineCallbackQueryUpdate
): void {
  events.publishTelegramInlineCallbackQueryReceived(update);
}
