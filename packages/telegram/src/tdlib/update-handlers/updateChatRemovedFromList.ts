import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { removeChatListMembership } from '../../store/chatListMembership.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatRemovedFromListUpdate = TelegramWireUpdateByType<'updateChatRemovedFromList'>;

export async function handleUpdateChatRemovedFromList(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatRemovedFromListUpdate
): Promise<void> {
  await removeChatListMembership(database, update);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
