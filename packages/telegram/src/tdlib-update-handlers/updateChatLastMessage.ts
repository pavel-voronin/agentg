import { storeChatLastMessage } from '../telegram-store/Chat.js';
import { recordMessageFiles, storeMessage } from '../telegram-store/Message.js';
import type { TelegramWireChatLastMessageUpdate } from '../telegram-wire.js';
import type { TelegramUpdateHandlerContext } from './context.js';

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
