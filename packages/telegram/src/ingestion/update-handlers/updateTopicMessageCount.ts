import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type TopicMessageCountUpdate = UpdateByType<'updateTopicMessageCount'>;

export function handleUpdateTopicMessageCount(
  update: TopicMessageCountUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, topicMessageCountKey(update), update.message_count);
}

function topicMessageCountKey(update: TopicMessageCountUpdate): string {
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
