import { upsertTelegramChatFragment } from '../../store/chat.js';
import { tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatPendingJoinRequestsUpdate = UpdateByType<'updateChatPendingJoinRequests'>;

export async function handleUpdateChatPendingJoinRequests(
  update: ChatPendingJoinRequestsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    pendingJoinRequests: tdJsonValue(update.pending_join_requests ?? null) ?? null
  });
}
