import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type DefaultReactionTypeUpdate = UpdateByType<'updateDefaultReactionType'>;

export function handleUpdateDefaultReactionType(
  update: DefaultReactionTypeUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'default_reaction_type', update.reaction_type);
}
