import { recordMessageFiles, storeMessage } from '../telegram-store/message.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireNewGuestQueryUpdate } from '../telegramWire.js';

export async function handleUpdateNewGuestQuery(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireNewGuestQueryUpdate
): Promise<void> {
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
