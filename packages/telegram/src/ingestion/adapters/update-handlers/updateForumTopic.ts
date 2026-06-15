import { applyIngestionChanges } from '../../applyChanges.js';
import { forumTopicChanges } from '../runtimeState.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ForumTopicUpdate = UpdateByType<'updateForumTopic'>;

export async function handleUpdateForumTopic(
  update: ForumTopicUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, forumTopicChanges(update));
}
