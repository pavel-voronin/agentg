import { applyIngestionChanges } from '../../applyChanges.js';
import { videoPublishedChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type VideoPublishedUpdate = UpdateByType<'updateVideoPublished'>;

export async function handleUpdateVideoPublished(
  update: VideoPublishedUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, videoPublishedChanges(update));
}
