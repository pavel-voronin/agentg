import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { removeChatListMembership } from '../telegram-store/chatListMembership.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatRemovedFromListUpdate = TelegramWireUpdateByType<'updateChatRemovedFromList'>;

export async function handleUpdateChatRemovedFromList(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatRemovedFromListUpdate
): Promise<void> {
  await removeChatListMembership(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
