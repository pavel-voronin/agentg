import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type SavedMessagesTopicCountUpdate = UpdateByType<'updateSavedMessagesTopicCount'>;

export function handleUpdateSavedMessagesTopicCount(
  update: SavedMessagesTopicCountUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'saved_messages_topic_count', update.topic_count);
}
