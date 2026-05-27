import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWirePendingTextMessageUpdate = TelegramWireUpdateByType<'updatePendingTextMessage'>;

export function handleUpdatePendingTextMessage(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWirePendingTextMessageUpdate
): void {
  events.publishTelegramPendingTextMessageUpdated(update);
}
