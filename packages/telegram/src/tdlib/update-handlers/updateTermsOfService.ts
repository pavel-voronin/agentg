import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { replaceTermsOfService } from '../../store/termsOfService.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireTermsOfServiceUpdate = TelegramWireUpdateByType<'updateTermsOfService'>;

export async function handleUpdateTermsOfService(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireTermsOfServiceUpdate
): Promise<void> {
  await replaceTermsOfService(context.database, update);
  context.events.publishTelegramTermsOfServiceRequired(update);
}
