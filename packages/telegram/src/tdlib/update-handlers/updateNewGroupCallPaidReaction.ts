import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNewGroupCallPaidReactionUpdate =
  TelegramWireUpdateByType<'updateNewGroupCallPaidReaction'>;

export function handleUpdateNewGroupCallPaidReaction(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewGroupCallPaidReactionUpdate
): void {
  events.publishTelegramGroupCallPaidReactionReceived(update);
}
