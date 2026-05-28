import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNewOauthRequestUpdate = TelegramWireUpdateByType<'updateNewOauthRequest'>;

export function handleUpdateNewOauthRequest(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewOauthRequestUpdate
): void {
  events.publishTelegramOauthRequestReceived(update);
}
