import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatActionUpdate = TelegramWireUpdateByType<'updateChatAction'>;

export function handleUpdateChatAction(update: TelegramWireChatActionUpdate): void {
  const events = useUpdateEvents();
  events.publishTelegramChatAction(update);
}
