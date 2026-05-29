import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWirePendingTextMessageUpdate = TelegramWireUpdateByType<'updatePendingTextMessage'>;

export function handleUpdatePendingTextMessage(update: TelegramWirePendingTextMessageUpdate): void {
  const events = useUpdateEvents();
  events.publishTelegramPendingTextMessageUpdated(update);
}
