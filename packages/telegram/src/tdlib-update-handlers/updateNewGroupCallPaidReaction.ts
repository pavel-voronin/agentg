import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireNewGroupCallPaidReactionUpdate =
  TelegramWireUpdateByType<'updateNewGroupCallPaidReaction'>;

export function handleUpdateNewGroupCallPaidReaction(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewGroupCallPaidReactionUpdate
): void {
  events.publishTelegramGroupCallPaidReactionReceived(update);
}
