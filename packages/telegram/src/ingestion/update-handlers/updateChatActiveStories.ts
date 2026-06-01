import { storeChatActiveStories } from '../../store/chatActiveStories.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatActiveStoriesUpdate = UpdateByType<'updateChatActiveStories'>;

export async function handleUpdateChatActiveStories(
  { active_stories: activeStories }: ChatActiveStoriesUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeChatActiveStories(database, activeStories);
}
