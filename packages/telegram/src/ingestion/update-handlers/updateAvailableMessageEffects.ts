import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type AvailableMessageEffectsUpdate = UpdateByType<'updateAvailableMessageEffects'>;

export function handleUpdateAvailableMessageEffects(
  update: AvailableMessageEffectsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'available_message_effects', {
    reaction_effect_ids: update.reaction_effect_ids,
    sticker_effect_ids: update.sticker_effect_ids
  });
}
