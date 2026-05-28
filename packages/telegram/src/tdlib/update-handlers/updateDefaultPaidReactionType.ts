import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireDefaultPaidReactionTypeUpdate =
  TelegramWireUpdateByType<'updateDefaultPaidReactionType'>;

const DEFAULT_PAID_REACTION_TYPE_KEY = 'default_paid_reaction_type';

export function handleUpdateDefaultPaidReactionType(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireDefaultPaidReactionTypeUpdate
): Promise<void> {
  return upsertTelegramKv(database, DEFAULT_PAID_REACTION_TYPE_KEY, update.type);
}
