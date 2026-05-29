import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatTitleUpdate = TelegramWireUpdateByType<'updateChatTitle'>;

export async function handleUpdateChatTitle(update: TelegramWireChatTitleUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    title: update.title
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
