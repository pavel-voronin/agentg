import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireNewOauthRequestUpdate = TelegramWireUpdateByType<'updateNewOauthRequest'>;

export function handleUpdateNewOauthRequest(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewOauthRequestUpdate
): void {
  events.publishTelegramOauthRequestReceived(update);
}
