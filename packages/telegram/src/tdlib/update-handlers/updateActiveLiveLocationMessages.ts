import { replaceActiveLiveLocationMessageSet, storeMessage } from '../../store/message.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireActiveLiveLocationMessagesUpdate =
  TelegramWireUpdateByType<'updateActiveLiveLocationMessages'>;

export async function handleUpdateActiveLiveLocationMessages(
  update: TelegramWireActiveLiveLocationMessagesUpdate
): Promise<void> {
  const database = useDatabase();
  await database.transaction(async (transaction) => {
    for (const message of update.messages) {
      await storeMessage(transaction, message);
    }

    await replaceActiveLiveLocationMessageSet(transaction, update.messages);
  });
}
