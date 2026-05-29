import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatActionBarUpdate = TelegramWireUpdateByType<'updateChatActionBar'>;

export async function handleUpdateChatActionBar(
  update: TelegramWireChatActionBarUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await upsertTelegramChatFragment(database, {
    id: String(update.chat_id),
    actionBar: telegramWireJsonValue(update.action_bar ?? null) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
