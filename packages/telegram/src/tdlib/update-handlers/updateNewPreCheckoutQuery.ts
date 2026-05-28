import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNewPreCheckoutQueryUpdate = TelegramWireUpdateByType<'updateNewPreCheckoutQuery'>;

export function handleUpdateNewPreCheckoutQuery(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewPreCheckoutQueryUpdate
): void {
  events.publishTelegramPreCheckoutQueryReceived(update);
}
