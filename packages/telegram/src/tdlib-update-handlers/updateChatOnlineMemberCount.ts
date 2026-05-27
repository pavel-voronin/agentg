import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatOnlineMemberCountUpdate =
  TelegramWireUpdateByType<'updateChatOnlineMemberCount'>;

export function handleUpdateChatOnlineMemberCount(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatOnlineMemberCountUpdate
): void {
  events.publishTelegramChatOnlineMemberCountUpdated(update);
}
