import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireWebAppMessageSentUpdate = TelegramWireUpdateByType<'updateWebAppMessageSent'>;

export function handleUpdateWebAppMessageSent(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireWebAppMessageSentUpdate
): Promise<void> {
  context.events.publishTelegramWebAppCloseRequested(update);
  return Promise.resolve();
}
