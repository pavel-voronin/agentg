import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireDefaultReactionTypeUpdate = TelegramWireUpdateByType<'updateDefaultReactionType'>;

export function handleUpdateDefaultReactionType(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireDefaultReactionTypeUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'default_reaction_type', update.reaction_type);
}
