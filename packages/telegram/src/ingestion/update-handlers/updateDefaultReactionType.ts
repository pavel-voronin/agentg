import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type DefaultReactionTypeUpdate = UpdateByType<'updateDefaultReactionType'>;

export function handleUpdateDefaultReactionType(
  update: DefaultReactionTypeUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'default_reaction_type', update.reaction_type);
}
