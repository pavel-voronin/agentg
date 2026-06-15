import { replaceActiveLiveLocationMessageSet, storeMessage } from '../../store/message.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ActiveLiveLocationMessagesUpdate = UpdateByType<'updateActiveLiveLocationMessages'>;

export async function handleUpdateActiveLiveLocationMessages(
  update: ActiveLiveLocationMessagesUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await database.transaction(async (transaction) => {
    for (const message of update.messages) {
      await storeMessage(transaction, message);
    }

    await replaceActiveLiveLocationMessageSet(transaction, update.messages);
  });
}
