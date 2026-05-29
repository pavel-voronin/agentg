import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireWebAppMessageSentUpdate = TelegramWireUpdateByType<'updateWebAppMessageSent'>;

export function handleUpdateWebAppMessageSent(
  update: TelegramWireWebAppMessageSentUpdate
): Promise<void> {
  const events = useUpdateEvents();
  events.publishTelegramWebAppCloseRequested(update);
  return Promise.resolve();
}
