import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ProfileAccentColorsUpdate = UpdateByType<'updateProfileAccentColors'>;

export function handleUpdateProfileAccentColors(
  update: ProfileAccentColorsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'profile_accent_colors', {
    colors: update.colors,
    available_accent_color_ids: update.available_accent_color_ids
  });
}
