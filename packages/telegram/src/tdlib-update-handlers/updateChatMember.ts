import { storeChatMember } from '../telegram-store/chatMember.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatMemberUpdate = TelegramWireUpdateByType<'updateChatMember'>;

export async function handleUpdateChatMember(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatMemberUpdate
): Promise<void> {
  await storeChatMember(database, update);
  events.publishTelegramChatMemberUpdated(update);
}
