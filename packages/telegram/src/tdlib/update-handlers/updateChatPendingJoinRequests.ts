import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatPendingJoinRequestsUpdate =
  TelegramWireUpdateByType<'updateChatPendingJoinRequests'>;

export async function handleUpdateChatPendingJoinRequests(
  update: TelegramWireChatPendingJoinRequestsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    pendingJoinRequests: telegramWireJsonValue(update.pending_join_requests ?? null) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
