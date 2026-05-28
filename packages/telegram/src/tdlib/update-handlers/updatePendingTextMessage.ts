import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWirePendingTextMessageUpdate = TelegramWireUpdateByType<'updatePendingTextMessage'>;

export function handleUpdatePendingTextMessage(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWirePendingTextMessageUpdate
): void {
  events.publishTelegramPendingTextMessageUpdated(update);
}
