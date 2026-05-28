import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNewCustomEventUpdate = TelegramWireUpdateByType<'updateNewCustomEvent'>;

export function handleUpdateNewCustomEvent(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewCustomEventUpdate
): void {
  events.publishTelegramCustomEventReceived(update);
}
