import type { TdlibUpdateNewChat } from '../tdlib-schema/UpdateNewChat.js';
import { persistTelegramChat } from '../telegram-chat-persistence.js';
import { persistTelegramMessage } from '../telegram-message-persistence.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateNewChat(
  { database, events, files }: TelegramUpdateHandlerContext,
  { chat }: TdlibUpdateNewChat
): Promise<void> {
  await database.transaction(async (transaction) => {
    if (chat.lastMessage !== null && chat.lastMessage !== undefined) {
      await persistTelegramMessage(transaction, chat.lastMessage);
    }

    await persistTelegramChat(transaction, chat);
  });

  await files.recordChatFiles(chat, 'live_update');
  if (chat.lastMessage !== null && chat.lastMessage !== undefined) {
    await files.recordMessageFiles(chat.lastMessage, 'live_update');
  }

  await events.publishTelegramChatDirectoryUpdated(chat.id);
}
