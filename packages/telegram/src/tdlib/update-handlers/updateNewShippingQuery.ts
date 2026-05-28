import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNewShippingQueryUpdate = TelegramWireUpdateByType<'updateNewShippingQuery'>;

export function handleUpdateNewShippingQuery(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewShippingQueryUpdate
): void {
  events.publishTelegramShippingQueryReceived(update);
}
