import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireTopicMessageCountUpdate = TelegramWireUpdateByType<'updateTopicMessageCount'>;

export function handleUpdateTopicMessageCount(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireTopicMessageCountUpdate
): Promise<void> {
  return upsertTelegramKv(database, topicMessageCountKey(update), update.message_count);
}

function topicMessageCountKey(update: TelegramWireTopicMessageCountUpdate): string {
  const chatId = String(update.chat_id);
  const topic = update.topic_id;

  switch (topic._) {
    case 'messageTopicDirectMessages':
      return `topic_message_count:${chatId}:direct_messages:${String(
        topic.direct_messages_chat_topic_id
      )}`;
    case 'messageTopicSavedMessages':
      return `topic_message_count:${chatId}:saved_messages:${String(topic.saved_messages_topic_id)}`;
    default:
      throw new Error(`Unsupported updateTopicMessageCount topic constructor: ${topic._}`);
  }
}
