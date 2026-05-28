import { recordChatFiles, storeChat } from '../../store/chat.js';
import { recordMessageFiles, storeMessage } from '../../store/message.js';
import type { TelegramWireNewChatUpdate } from '../wire.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';

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
