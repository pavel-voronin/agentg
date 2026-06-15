import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type NewOauthRequestUpdate = UpdateByType<'updateNewOauthRequest'>;

export function handleUpdateNewOauthRequest(
  update: NewOauthRequestUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
