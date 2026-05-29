import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireNewCallSignalingDataUpdate =
  TelegramWireUpdateByType<'updateNewCallSignalingData'>;

export function handleUpdateNewCallSignalingData(
  update: TelegramWireNewCallSignalingDataUpdate
): void {
  const events = useUpdateEvents();
  events.publishTelegramCallSignalingDataReceived(update);
}
