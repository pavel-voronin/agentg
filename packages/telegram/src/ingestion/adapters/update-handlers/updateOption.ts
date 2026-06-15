import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type OptionUpdate = UpdateByType<'updateOption'>;

export function handleUpdateOption(
  update: OptionUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, `option:${update.name}`, update.value);
}
