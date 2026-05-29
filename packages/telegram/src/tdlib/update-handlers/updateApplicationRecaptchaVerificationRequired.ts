import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireApplicationRecaptchaVerificationRequiredUpdate =
  TelegramWireUpdateByType<'updateApplicationRecaptchaVerificationRequired'>;

export function handleUpdateApplicationRecaptchaVerificationRequired(
  update: TelegramWireApplicationRecaptchaVerificationRequiredUpdate
): void {
  const events = useUpdateEvents();
  events.publishTelegramApplicationRecaptchaVerificationRequired(update);
}
