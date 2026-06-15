import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type NewCustomEventUpdate = UpdateByType<'updateNewCustomEvent'>;

export function handleUpdateNewCustomEvent(
  update: NewCustomEventUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
