import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireNewChosenInlineResultUpdate =
  TelegramWireUpdateByType<'updateNewChosenInlineResult'>;

export function handleUpdateNewChosenInlineResult(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewChosenInlineResultUpdate
): void {
  events.publishTelegramChosenInlineResultReceived(update);
}
