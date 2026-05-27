import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatActionUpdate = TelegramWireUpdateByType<'updateChatAction'>;

export function handleUpdateChatAction(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatActionUpdate
): void {
  events.publishTelegramChatAction(update);
}
