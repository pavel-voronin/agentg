import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type NewCustomQueryUpdate = UpdateByType<'updateNewCustomQuery'>;

export function handleUpdateNewCustomQuery(
  update: NewCustomQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
