import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatHasScheduledMessagesUpdate = UpdateByType<'updateChatHasScheduledMessages'>;

export async function handleUpdateChatHasScheduledMessages(
  update: ChatHasScheduledMessagesUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    hasScheduledMessages: update.has_scheduled_messages,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
