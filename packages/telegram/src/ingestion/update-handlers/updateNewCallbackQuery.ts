import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type NewCallbackQueryUpdate = UpdateByType<'updateNewCallbackQuery'>;

export function handleUpdateNewCallbackQuery(
  update: NewCallbackQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
