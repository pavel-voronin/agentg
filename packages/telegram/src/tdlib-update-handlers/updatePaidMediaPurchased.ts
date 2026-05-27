import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWirePaidMediaPurchasedUpdate = TelegramWireUpdateByType<'updatePaidMediaPurchased'>;

export function handleUpdatePaidMediaPurchased(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWirePaidMediaPurchasedUpdate
): void {
  events.publishTelegramPaidMediaPurchased(update);
}
