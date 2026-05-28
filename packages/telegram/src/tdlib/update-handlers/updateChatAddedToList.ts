import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { storeChatListMembership } from '../../store/chatListMembership.js';
import type { TelegramWireChatAddedToListUpdate } from '../wire.js';

export async function handleUpdateChatAddedToList(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatAddedToListUpdate
): Promise<void> {
  await storeChatListMembership(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
