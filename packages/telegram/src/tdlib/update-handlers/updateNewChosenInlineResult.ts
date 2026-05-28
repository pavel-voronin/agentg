import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNewChosenInlineResultUpdate =
  TelegramWireUpdateByType<'updateNewChosenInlineResult'>;

export function handleUpdateNewChosenInlineResult(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewChosenInlineResultUpdate
): void {
  events.publishTelegramChosenInlineResultReceived(update);
}
