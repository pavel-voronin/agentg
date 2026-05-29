import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireNewInlineQueryUpdate = TelegramWireUpdateByType<'updateNewInlineQuery'>;

export function handleUpdateNewInlineQuery(update: TelegramWireNewInlineQueryUpdate): void {
  const events = useUpdateEvents();
  events.publishTelegramInlineQueryReceived(update);
}
