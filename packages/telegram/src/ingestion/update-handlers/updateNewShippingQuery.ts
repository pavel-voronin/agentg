import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type NewShippingQueryUpdate = UpdateByType<'updateNewShippingQuery'>;

export function handleUpdateNewShippingQuery(
  update: NewShippingQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
