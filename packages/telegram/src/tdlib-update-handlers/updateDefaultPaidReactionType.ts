import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireDefaultPaidReactionTypeUpdate =
  TelegramWireUpdateByType<'updateDefaultPaidReactionType'>;

const DEFAULT_PAID_REACTION_TYPE_KEY = 'default_paid_reaction_type';

export function handleUpdateDefaultPaidReactionType(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireDefaultPaidReactionTypeUpdate
): Promise<void> {
  return upsertTelegramKv(database, DEFAULT_PAID_REACTION_TYPE_KEY, update.type);
}
