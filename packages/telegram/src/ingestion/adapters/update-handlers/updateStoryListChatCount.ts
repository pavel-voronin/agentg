import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type StoryListChatCountUpdate = UpdateByType<'updateStoryListChatCount'>;

export function handleUpdateStoryListChatCount(
  update: StoryListChatCountUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, `story_list_chat_count:${update.story_list._}`, update.chat_count);
}
