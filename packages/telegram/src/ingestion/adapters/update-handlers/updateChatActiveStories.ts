import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatActiveStoriesChanges } from '../state.js';
import type { IngestionResources } from '../../resources.js';

type ChatActiveStoriesUpdate = UpdateByType<'updateChatActiveStories'>;

export async function handleUpdateChatActiveStories(
  update: ChatActiveStoriesUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatActiveStoriesChanges(update));
}
