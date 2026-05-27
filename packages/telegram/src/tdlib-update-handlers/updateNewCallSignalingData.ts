import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireNewCallSignalingDataUpdate =
  TelegramWireUpdateByType<'updateNewCallSignalingData'>;

export function handleUpdateNewCallSignalingData(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewCallSignalingDataUpdate
): void {
  events.publishTelegramCallSignalingDataReceived(update);
}
