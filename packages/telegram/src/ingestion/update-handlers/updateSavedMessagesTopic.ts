import { storeMessage } from '../../store/message.js';
import { upsertSavedMessagesTopic } from '../../store/savedMessages.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type SavedMessagesTopicUpdate = UpdateByType<'updateSavedMessagesTopic'>;

export async function handleUpdateSavedMessagesTopic(
  update: SavedMessagesTopicUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  const { topic } = update;
  const lastMessage = topic.last_message ?? null;

  await database.transaction(async (transaction) => {
    if (lastMessage !== null) {
      await storeMessage(transaction, lastMessage);
    }

    await upsertSavedMessagesTopic(transaction, topic);
  });

  if (lastMessage !== null) {
    await files.recordMessageFiles(lastMessage, 'live_update');
  }
}
