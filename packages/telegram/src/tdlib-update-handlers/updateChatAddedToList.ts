import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { storeChatListMembership } from '../telegram-store/chatListMembership.js';
import type { TelegramWireChatAddedToListUpdate } from '../telegramWire.js';

export async function handleUpdateChatAddedToList(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatAddedToListUpdate
): Promise<void> {
  await storeChatListMembership(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
