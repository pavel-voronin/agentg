import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireApplicationVerificationRequiredUpdate =
  TelegramWireUpdateByType<'updateApplicationVerificationRequired'>;

export function handleUpdateApplicationVerificationRequired(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireApplicationVerificationRequiredUpdate
): void {
  events.publishTelegramApplicationVerificationRequired(update);
}
