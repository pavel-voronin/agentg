import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireAvailableMessageEffectsUpdate =
  TelegramWireUpdateByType<'updateAvailableMessageEffects'>;

export function handleUpdateAvailableMessageEffects(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireAvailableMessageEffectsUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'available_message_effects', {
    reaction_effect_ids: update.reaction_effect_ids,
    sticker_effect_ids: update.sticker_effect_ids
  });
}
