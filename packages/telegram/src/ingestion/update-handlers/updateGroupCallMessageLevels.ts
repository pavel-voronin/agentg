import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type GroupCallMessageLevelsUpdate = UpdateByType<'updateGroupCallMessageLevels'>;

export function handleUpdateGroupCallMessageLevels(
  update: GroupCallMessageLevelsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'group_call_message_levels', update.levels);
}
