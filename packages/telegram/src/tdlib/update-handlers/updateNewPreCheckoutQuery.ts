import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireNewPreCheckoutQueryUpdate = TelegramWireUpdateByType<'updateNewPreCheckoutQuery'>;

export function handleUpdateNewPreCheckoutQuery(
  update: TelegramWireNewPreCheckoutQueryUpdate
): void {
  const events = useUpdateEvents();
  events.publishTelegramPreCheckoutQueryReceived(update);
}
