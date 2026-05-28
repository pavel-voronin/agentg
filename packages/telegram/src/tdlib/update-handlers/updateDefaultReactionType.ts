import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireDefaultReactionTypeUpdate = TelegramWireUpdateByType<'updateDefaultReactionType'>;

export function handleUpdateDefaultReactionType(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireDefaultReactionTypeUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'default_reaction_type', update.reaction_type);
}
