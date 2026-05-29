import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireNewInlineCallbackQueryUpdate =
  TelegramWireUpdateByType<'updateNewInlineCallbackQuery'>;

export function handleUpdateNewInlineCallbackQuery(
  update: TelegramWireNewInlineCallbackQueryUpdate
): void {
  const events = useUpdateEvents();
  events.publishTelegramInlineCallbackQueryReceived(update);
}
