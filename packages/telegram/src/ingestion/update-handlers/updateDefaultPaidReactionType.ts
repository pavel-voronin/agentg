import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type DefaultPaidReactionTypeUpdate = UpdateByType<'updateDefaultPaidReactionType'>;

const DEFAULT_PAID_REACTION_TYPE_KEY = 'default_paid_reaction_type';

export function handleUpdateDefaultPaidReactionType(
  update: DefaultPaidReactionTypeUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, DEFAULT_PAID_REACTION_TYPE_KEY, update.type);
}
