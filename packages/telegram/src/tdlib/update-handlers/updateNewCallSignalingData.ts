import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNewCallSignalingDataUpdate =
  TelegramWireUpdateByType<'updateNewCallSignalingData'>;

export function handleUpdateNewCallSignalingData(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewCallSignalingDataUpdate
): void {
  events.publishTelegramCallSignalingDataReceived(update);
}
