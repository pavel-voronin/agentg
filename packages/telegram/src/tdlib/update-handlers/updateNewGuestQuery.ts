import { recordMessageFiles, storeMessage } from '../../store/message.js';
import type { TelegramWireNewGuestQueryUpdate } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

export async function handleUpdateNewGuestQuery(
  update: TelegramWireNewGuestQueryUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
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

  events.publishTelegramGuestQueryReceived({
    id: update.id,
    message: update.message,
    referenceMessages: update.reference_messages
  });
}
