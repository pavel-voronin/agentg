import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type NewPreCheckoutQueryUpdate = UpdateByType<'updateNewPreCheckoutQuery'>;

export function handleUpdateNewPreCheckoutQuery(
  update: NewPreCheckoutQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
