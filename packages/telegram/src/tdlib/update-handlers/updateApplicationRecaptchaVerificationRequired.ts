import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireApplicationRecaptchaVerificationRequiredUpdate =
  TelegramWireUpdateByType<'updateApplicationRecaptchaVerificationRequired'>;

export function handleUpdateApplicationRecaptchaVerificationRequired(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireApplicationRecaptchaVerificationRequiredUpdate
): void {
  events.publishTelegramApplicationRecaptchaVerificationRequired(update);
}
