import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireNewCustomQueryUpdate = TelegramWireUpdateByType<'updateNewCustomQuery'>;

export function handleUpdateNewCustomQuery(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewCustomQueryUpdate
): void {
  events.publishTelegramCustomQueryReceived(update);
}
