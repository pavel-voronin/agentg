import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNewInlineQueryUpdate = TelegramWireUpdateByType<'updateNewInlineQuery'>;

export function handleUpdateNewInlineQuery(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewInlineQueryUpdate
): void {
  events.publishTelegramInlineQueryReceived(update);
}
