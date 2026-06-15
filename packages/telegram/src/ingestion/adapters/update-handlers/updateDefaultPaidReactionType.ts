import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type DefaultPaidReactionTypeUpdate = UpdateByType<'updateDefaultPaidReactionType'>;

const DEFAULT_PAID_REACTION_TYPE_KEY = 'default_paid_reaction_type';

export function handleUpdateDefaultPaidReactionType(
  update: DefaultPaidReactionTypeUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, DEFAULT_PAID_REACTION_TYPE_KEY, update.type);
}
