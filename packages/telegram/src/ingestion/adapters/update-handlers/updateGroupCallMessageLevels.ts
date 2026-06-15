import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type GroupCallMessageLevelsUpdate = UpdateByType<'updateGroupCallMessageLevels'>;

export function handleUpdateGroupCallMessageLevels(
  update: GroupCallMessageLevelsUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'group_call_message_levels', update.levels);
}
