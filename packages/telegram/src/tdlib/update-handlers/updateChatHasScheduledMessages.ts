import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatHasScheduledMessagesUpdate =
  TelegramWireUpdateByType<'updateChatHasScheduledMessages'>;

export async function handleUpdateChatHasScheduledMessages(
  update: TelegramWireChatHasScheduledMessagesUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    hasScheduledMessages: update.has_scheduled_messages,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
