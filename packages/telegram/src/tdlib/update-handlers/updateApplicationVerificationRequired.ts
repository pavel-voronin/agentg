import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireApplicationVerificationRequiredUpdate =
  TelegramWireUpdateByType<'updateApplicationVerificationRequired'>;

export function handleUpdateApplicationVerificationRequired(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireApplicationVerificationRequiredUpdate
): void {
  events.publishTelegramApplicationVerificationRequired(update);
}
