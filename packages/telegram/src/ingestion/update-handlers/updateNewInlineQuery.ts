import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type NewInlineQueryUpdate = UpdateByType<'updateNewInlineQuery'>;

export function handleUpdateNewInlineQuery(
  update: NewInlineQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
