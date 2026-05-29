import type { TelegramWireUpdateByType } from '../wire.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatOnlineMemberCountUpdate =
  TelegramWireUpdateByType<'updateChatOnlineMemberCount'>;

export function handleUpdateChatOnlineMemberCount(
  update: TelegramWireChatOnlineMemberCountUpdate
): void {
  const events = useUpdateEvents();
  events.publishTelegramChatOnlineMemberCountUpdated(update);
}
