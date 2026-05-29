import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireNewCustomQueryUpdate = TelegramWireUpdateByType<'updateNewCustomQuery'>;

export function handleUpdateNewCustomQuery(update: TelegramWireNewCustomQueryUpdate): void {
  const events = useUpdateEvents();
  events.publishTelegramCustomQueryReceived(update);
}
