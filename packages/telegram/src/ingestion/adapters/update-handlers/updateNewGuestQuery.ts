import { applyIngestionChangesToDatabase } from '../../applyChanges.js';
import { messageFileSlots } from '../fileSlot.js';
import { savedMessagesChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type NewGuestQueryUpdate = UpdateByType<'updateNewGuestQuery'>;

export async function handleUpdateNewGuestQuery(
  update: NewGuestQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database, files } = resources;
  await database.transaction(async (transaction) => {
    await applyIngestionChangesToDatabase(
      resources,
      transaction,
      savedMessagesChanges([update.message, ...update.reference_messages])
    );
  });

  await files.recordFileSlots(messageFileSlots(update.message), 'live_update');
  for (const message of update.reference_messages) {
    await files.recordFileSlots(messageFileSlots(message), 'live_update');
  }
}
