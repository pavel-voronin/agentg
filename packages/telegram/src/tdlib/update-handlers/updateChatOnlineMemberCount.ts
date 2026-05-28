import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatOnlineMemberCountUpdate =
  TelegramWireUpdateByType<'updateChatOnlineMemberCount'>;

export function handleUpdateChatOnlineMemberCount(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatOnlineMemberCountUpdate
): void {
  events.publishTelegramChatOnlineMemberCountUpdated(update);
}
