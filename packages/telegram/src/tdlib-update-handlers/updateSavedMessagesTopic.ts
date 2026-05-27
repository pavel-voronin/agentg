import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { storeMessage } from '../telegram-store/message.js';
import { upsertSavedMessagesTopic } from '../telegram-store/savedMessages.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireSavedMessagesTopicUpdate = TelegramWireUpdateByType<'updateSavedMessagesTopic'>;

export async function handleUpdateSavedMessagesTopic(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireSavedMessagesTopicUpdate
): Promise<void> {
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
