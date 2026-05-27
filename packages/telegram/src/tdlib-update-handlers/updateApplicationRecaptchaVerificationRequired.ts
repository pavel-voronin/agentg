import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireApplicationRecaptchaVerificationRequiredUpdate =
  TelegramWireUpdateByType<'updateApplicationRecaptchaVerificationRequired'>;

export function handleUpdateApplicationRecaptchaVerificationRequired(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireApplicationRecaptchaVerificationRequiredUpdate
): void {
  events.publishTelegramApplicationRecaptchaVerificationRequired(update);
}
