import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { storeDirectMessagesChatTopic } from '../telegram-store/directMessagesChatTopic.js';
import { recordMessageFiles, storeMessage } from '../telegram-store/message.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireDirectMessagesChatTopicUpdate =
  TelegramWireUpdateByType<'updateDirectMessagesChatTopic'>;

export async function handleUpdateDirectMessagesChatTopic(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireDirectMessagesChatTopicUpdate
): Promise<void> {
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

  events.publishTelegramDirectMessagesChatTopicUpdated({
    chatId: String(topic.chat_id),
    topicId: String(topic.id)
  });
}
