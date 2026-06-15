import { applyIngestionChanges } from '../../applyChanges.js';
import { forumTopicInfoChanges } from '../runtimeState.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ForumTopicInfoUpdate = UpdateByType<'updateForumTopicInfo'>;

export async function handleUpdateForumTopicInfo(
  update: ForumTopicInfoUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, forumTopicInfoChanges(update));
}
