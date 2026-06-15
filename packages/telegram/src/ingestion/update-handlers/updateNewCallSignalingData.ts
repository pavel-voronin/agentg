import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type NewCallSignalingDataUpdate = UpdateByType<'updateNewCallSignalingData'>;

export function handleUpdateNewCallSignalingData(
  update: NewCallSignalingDataUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
