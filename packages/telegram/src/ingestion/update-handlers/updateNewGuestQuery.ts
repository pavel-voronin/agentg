import { recordMessageFiles, storeMessage } from '../../store/message.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type NewGuestQueryUpdate = UpdateByType<'updateNewGuestQuery'>;

export async function handleUpdateNewGuestQuery(
  update: NewGuestQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  await database.transaction(async (transaction) => {
    await storeMessage(transaction, update.message);

    for (const message of update.reference_messages) {
      await storeMessage(transaction, message);
    }
  });

  await recordMessageFiles(files, update.message, 'live_update');
  for (const message of update.reference_messages) {
    await recordMessageFiles(files, message, 'live_update');
  }
}
