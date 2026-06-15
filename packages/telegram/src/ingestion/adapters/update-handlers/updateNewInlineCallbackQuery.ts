import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type NewInlineCallbackQueryUpdate = UpdateByType<'updateNewInlineCallbackQuery'>;

export function handleUpdateNewInlineCallbackQuery(
  update: NewInlineCallbackQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
