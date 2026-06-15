import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type NewChosenInlineResultUpdate = UpdateByType<'updateNewChosenInlineResult'>;

export function handleUpdateNewChosenInlineResult(
  update: NewChosenInlineResultUpdate,
  resources: IngestionResources
): Promise<void> {
  void update;
  void resources;
  return Promise.resolve();
}
