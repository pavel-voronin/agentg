import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireApplicationVerificationRequiredUpdate =
  TelegramWireUpdateByType<'updateApplicationVerificationRequired'>;

export function handleUpdateApplicationVerificationRequired(
  update: TelegramWireApplicationVerificationRequiredUpdate
): void {
  const events = useUpdateEvents();
  events.publishTelegramApplicationVerificationRequired(update);
}
