import { storeMessage } from '../../store/message.js';
import { upsertSavedMessagesTopic } from '../../store/savedMessages.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireSavedMessagesTopicUpdate = TelegramWireUpdateByType<'updateSavedMessagesTopic'>;

export async function handleUpdateSavedMessagesTopic(
  update: TelegramWireSavedMessagesTopicUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
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

  events.publishTelegramSavedMessagesTopicUpdated(update);
}
