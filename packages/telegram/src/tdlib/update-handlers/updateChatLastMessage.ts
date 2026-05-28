import { storeChatLastMessage } from '../../store/chat.js';
import { recordMessageFiles, storeMessage } from '../../store/message.js';
import type { TelegramWireChatLastMessageUpdate } from '../wire.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';

export async function handleUpdateChatLastMessage(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireChatLastMessageUpdate
): Promise<void> {
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
