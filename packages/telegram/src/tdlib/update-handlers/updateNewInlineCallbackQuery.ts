import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNewInlineCallbackQueryUpdate =
  TelegramWireUpdateByType<'updateNewInlineCallbackQuery'>;

export function handleUpdateNewInlineCallbackQuery(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewInlineCallbackQueryUpdate
): void {
  events.publishTelegramInlineCallbackQueryReceived(update);
}
