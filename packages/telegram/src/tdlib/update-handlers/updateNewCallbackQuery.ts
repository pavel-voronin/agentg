import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireNewCallbackQueryUpdate = TelegramWireUpdateByType<'updateNewCallbackQuery'>;

export function handleUpdateNewCallbackQuery(update: TelegramWireNewCallbackQueryUpdate): void {
  const events = useUpdateEvents();
  events.publishTelegramCallbackQueryReceived(update);
}
