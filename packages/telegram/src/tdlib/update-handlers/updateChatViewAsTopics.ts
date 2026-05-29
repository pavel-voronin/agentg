import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatViewAsTopicsUpdate = TelegramWireUpdateByType<'updateChatViewAsTopics'>;

export async function handleUpdateChatViewAsTopics(
  update: TelegramWireChatViewAsTopicsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    viewAsTopics: update.view_as_topics
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
