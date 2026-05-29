import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireDefaultPaidReactionTypeUpdate =
  TelegramWireUpdateByType<'updateDefaultPaidReactionType'>;

const DEFAULT_PAID_REACTION_TYPE_KEY = 'default_paid_reaction_type';

export function handleUpdateDefaultPaidReactionType(
  update: TelegramWireDefaultPaidReactionTypeUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, DEFAULT_PAID_REACTION_TYPE_KEY, update.type);
}
