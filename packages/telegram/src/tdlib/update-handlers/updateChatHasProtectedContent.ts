import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatHasProtectedContentUpdate =
  TelegramWireUpdateByType<'updateChatHasProtectedContent'>;

export async function handleUpdateChatHasProtectedContent(
  update: TelegramWireChatHasProtectedContentUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    hasProtectedContent: update.has_protected_content,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
