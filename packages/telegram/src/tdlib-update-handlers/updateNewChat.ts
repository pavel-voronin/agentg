import { recordChatFiles, storeChat } from '../telegram-store/Chat.js';
import { recordMessageFiles, storeMessage } from '../telegram-store/Message.js';
import type { TelegramWireNewChatUpdate } from '../telegram-wire.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateNewChat(
  { database, events, files }: TelegramUpdateHandlerContext,
  { chat }: TelegramWireNewChatUpdate
): Promise<void> {
  const lastMessage = chat.last_message ?? null;
  await database.transaction(async (transaction) => {
    if (lastMessage !== null) {
      await storeMessage(transaction, lastMessage);
    }

    await storeChat(transaction, chat);
  });

  await recordChatFiles(files, chat, 'live_update');
  if (lastMessage !== null) {
    await recordMessageFiles(files, lastMessage, 'live_update');
  }

  await events.publishTelegramChatDirectoryUpdated(String(chat.id));
}
