import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ProfileAccentColorsUpdate = UpdateByType<'updateProfileAccentColors'>;

export function handleUpdateProfileAccentColors(
  update: ProfileAccentColorsUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'profile_accent_colors', {
    colors: update.colors,
    available_accent_color_ids: update.available_accent_color_ids
  });
}
