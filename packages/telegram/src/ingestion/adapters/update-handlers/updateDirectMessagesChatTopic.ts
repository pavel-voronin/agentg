import { applyIngestionChangesToDatabase } from '../../applyChanges.js';
import { messageFileSlots } from '../fileSlot.js';
import { directMessagesChatTopicChanges } from '../topic.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type DirectMessagesChatTopicUpdate = UpdateByType<'updateDirectMessagesChatTopic'>;

export async function handleUpdateDirectMessagesChatTopic(
  update: DirectMessagesChatTopicUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database, files } = resources;
  const { topic } = update;
  const lastMessage = topic.last_message ?? null;

  await database.transaction(async (transaction) => {
    await applyIngestionChangesToDatabase(
      resources,
      transaction,
      directMessagesChatTopicChanges(update)
    );
  });

  if (lastMessage !== null) {
    await files.recordFileSlots(messageFileSlots(lastMessage), 'live_update');
  }
}
