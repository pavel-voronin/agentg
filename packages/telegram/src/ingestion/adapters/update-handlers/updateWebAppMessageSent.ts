import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type WebAppMessageSentUpdate = UpdateByType<'updateWebAppMessageSent'>;

export function handleUpdateWebAppMessageSent(
  update: WebAppMessageSentUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
