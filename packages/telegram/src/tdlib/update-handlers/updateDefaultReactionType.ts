import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireDefaultReactionTypeUpdate = TelegramWireUpdateByType<'updateDefaultReactionType'>;

export function handleUpdateDefaultReactionType(
  update: TelegramWireDefaultReactionTypeUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'default_reaction_type', update.reaction_type);
}
