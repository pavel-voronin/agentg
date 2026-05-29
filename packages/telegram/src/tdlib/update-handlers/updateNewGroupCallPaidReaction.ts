import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireNewGroupCallPaidReactionUpdate =
  TelegramWireUpdateByType<'updateNewGroupCallPaidReaction'>;

export function handleUpdateNewGroupCallPaidReaction(
  update: TelegramWireNewGroupCallPaidReactionUpdate
): void {
  const events = useUpdateEvents();
  events.publishTelegramGroupCallPaidReactionReceived(update);
}
