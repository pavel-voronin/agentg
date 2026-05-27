import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireWebAppMessageSentUpdate = TelegramWireUpdateByType<'updateWebAppMessageSent'>;

export function handleUpdateWebAppMessageSent(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireWebAppMessageSentUpdate
): Promise<void> {
  context.events.publishTelegramWebAppCloseRequested(update);
  return Promise.resolve();
}
