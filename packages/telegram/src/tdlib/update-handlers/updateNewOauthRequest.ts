import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireNewOauthRequestUpdate = TelegramWireUpdateByType<'updateNewOauthRequest'>;

export function handleUpdateNewOauthRequest(update: TelegramWireNewOauthRequestUpdate): void {
  const events = useUpdateEvents();
  events.publishTelegramOauthRequestReceived(update);
}
