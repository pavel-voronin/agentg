import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type AccentColorsUpdate = UpdateByType<'updateAccentColors'>;

export function handleUpdateAccentColors(
  update: AccentColorsUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'accent_colors', {
    colors: update.colors,
    available_accent_color_ids: update.available_accent_color_ids
  });
}
