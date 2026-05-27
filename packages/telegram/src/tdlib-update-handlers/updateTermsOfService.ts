import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { replaceTermsOfService } from '../telegram-store/termsOfService.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireTermsOfServiceUpdate = TelegramWireUpdateByType<'updateTermsOfService'>;

export async function handleUpdateTermsOfService(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireTermsOfServiceUpdate
): Promise<void> {
  await replaceTermsOfService(context.database, update);
  context.events.publishTelegramTermsOfServiceRequired(update);
}
