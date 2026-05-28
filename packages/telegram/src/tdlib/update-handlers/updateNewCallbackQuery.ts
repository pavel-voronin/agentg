import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNewCallbackQueryUpdate = TelegramWireUpdateByType<'updateNewCallbackQuery'>;

export function handleUpdateNewCallbackQuery(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewCallbackQueryUpdate
): void {
  events.publishTelegramCallbackQueryReceived(update);
}
