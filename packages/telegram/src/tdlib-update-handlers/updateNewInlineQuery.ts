import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireNewInlineQueryUpdate = TelegramWireUpdateByType<'updateNewInlineQuery'>;

export function handleUpdateNewInlineQuery(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewInlineQueryUpdate
): void {
  events.publishTelegramInlineQueryReceived(update);
}
