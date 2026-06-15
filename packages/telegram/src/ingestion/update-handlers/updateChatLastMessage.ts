import { storeChatLastMessage } from '../../store/chat.js';
import { recordMessageFiles, storeMessage } from '../../store/message.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatLastMessageUpdate = UpdateByType<'updateChatLastMessage'>;

export async function handleUpdateChatLastMessage(
  update: ChatLastMessageUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
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
}
