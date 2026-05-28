import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatPendingJoinRequestsUpdate =
  TelegramWireUpdateByType<'updateChatPendingJoinRequests'>;

export async function handleUpdateChatPendingJoinRequests(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatPendingJoinRequestsUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    pendingJoinRequests: telegramWireJsonValue(update.pending_join_requests ?? null) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
