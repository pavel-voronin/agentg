import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatActionUpdate = TelegramWireUpdateByType<'updateChatAction'>;

export function handleUpdateChatAction(
  { events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatActionUpdate
): void {
  events.publishTelegramChatAction(update);
}
