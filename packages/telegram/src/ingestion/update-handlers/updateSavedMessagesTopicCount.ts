import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type SavedMessagesTopicCountUpdate = UpdateByType<'updateSavedMessagesTopicCount'>;

export function handleUpdateSavedMessagesTopicCount(
  update: SavedMessagesTopicCountUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'saved_messages_topic_count', update.topic_count);
}
