import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireAvailableMessageEffectsUpdate =
  TelegramWireUpdateByType<'updateAvailableMessageEffects'>;

export function handleUpdateAvailableMessageEffects(
  update: TelegramWireAvailableMessageEffectsUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'available_message_effects', {
    reaction_effect_ids: update.reaction_effect_ids,
    sticker_effect_ids: update.sticker_effect_ids
  });
}
