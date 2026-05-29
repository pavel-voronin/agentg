import { storeChatLastMessage } from '../../store/chat.js';
import { recordMessageFiles, storeMessage } from '../../store/message.js';
import type { TelegramWireChatLastMessageUpdate } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

export async function handleUpdateChatLastMessage(
  update: TelegramWireChatLastMessageUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  const lastMessage = update.last_message ?? null;
  await database.transaction(async (transaction) => {
    if (lastMessage !== null) {
      await storeMessage(transaction, lastMessage);
    }

    await storeChatLastMessage(transaction, update);
  });

  if (lastMessage !== null) {
    await recordMessageFiles(files, lastMessage, 'live_update');
  }

  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
