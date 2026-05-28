import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNewCustomQueryUpdate = TelegramWireUpdateByType<'updateNewCustomQuery'>;

export function handleUpdateNewCustomQuery(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewCustomQueryUpdate
): void {
  events.publishTelegramCustomQueryReceived(update);
}
