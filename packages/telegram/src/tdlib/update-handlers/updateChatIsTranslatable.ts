import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatIsTranslatableUpdate = TelegramWireUpdateByType<'updateChatIsTranslatable'>;

export async function handleUpdateChatIsTranslatable(
  update: TelegramWireChatIsTranslatableUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    isTranslatable: update.is_translatable
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
