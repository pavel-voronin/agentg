import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type OptionUpdate = UpdateByType<'updateOption'>;

export function handleUpdateOption(
  update: OptionUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, `option:${update.name}`, update.value);
}
