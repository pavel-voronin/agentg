import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type StoryListChatCountUpdate = UpdateByType<'updateStoryListChatCount'>;

export function handleUpdateStoryListChatCount(
  update: StoryListChatCountUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(
    database,
    `story_list_chat_count:${update.story_list._}`,
    update.chat_count
  );
}
