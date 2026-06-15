import { storeDirectMessagesChatTopic } from '../../store/directMessagesChatTopic.js';
import { recordMessageFiles, storeMessage } from '../../store/message.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type DirectMessagesChatTopicUpdate = UpdateByType<'updateDirectMessagesChatTopic'>;

export async function handleUpdateDirectMessagesChatTopic(
  update: DirectMessagesChatTopicUpdate,
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

    await storeDirectMessagesChatTopic(transaction, topic);
  });

  if (lastMessage !== null) {
    await recordMessageFiles(files, lastMessage, 'live_update');
  }
}
