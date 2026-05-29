import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireNewChosenInlineResultUpdate =
  TelegramWireUpdateByType<'updateNewChosenInlineResult'>;

export function handleUpdateNewChosenInlineResult(
  update: TelegramWireNewChosenInlineResultUpdate
): void {
  const events = useUpdateEvents();
  events.publishTelegramChosenInlineResultReceived(update);
}
