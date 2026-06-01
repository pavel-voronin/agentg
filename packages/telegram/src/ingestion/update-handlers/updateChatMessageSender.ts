import { upsertTelegramChatFragment } from '../../store/chat.js';
import { tdJsonValue, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatMessageSenderUpdate = UpdateByType<'updateChatMessageSender'>;

export async function handleUpdateChatMessageSender(
  update: ChatMessageSenderUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    messageSenderId: tdJsonValue(update.message_sender_id ?? null) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
