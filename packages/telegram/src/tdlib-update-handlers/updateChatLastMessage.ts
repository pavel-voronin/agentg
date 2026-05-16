import type { TdlibUpdateChatLastMessage } from '../tdlib-schema/UpdateChatLastMessage.js';
import { persistTelegramChatLastMessage } from '../telegram-chat-persistence.js';
import { persistTelegramMessage } from '../telegram-message-persistence.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateChatLastMessage(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TdlibUpdateChatLastMessage
): Promise<void> {
  await database.transaction(async (transaction) => {
    if (update.lastMessage !== null) {
      await persistTelegramMessage(transaction, update.lastMessage);
    }

    await persistTelegramChatLastMessage(transaction, update);
  });

  if (update.lastMessage !== null) {
    await files.recordMessageFiles(update.lastMessage, 'live_update');
  }

  await events.publishTelegramChatDirectoryUpdated(update.chatId);
}
