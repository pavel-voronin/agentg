import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWirePaidMediaPurchasedUpdate = TelegramWireUpdateByType<'updatePaidMediaPurchased'>;

export function handleUpdatePaidMediaPurchased(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWirePaidMediaPurchasedUpdate
): void {
  events.publishTelegramPaidMediaPurchased(update);
}
