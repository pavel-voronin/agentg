import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type PendingTextMessageUpdate = UpdateByType<'updatePendingTextMessage'>;

export function handleUpdatePendingTextMessage(
  update: PendingTextMessageUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
