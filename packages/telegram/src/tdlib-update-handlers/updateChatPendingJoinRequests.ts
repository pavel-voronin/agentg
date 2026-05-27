import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramChatFragment } from '../telegram-store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../telegramWire.js';

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
