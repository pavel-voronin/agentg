import { applyIngestionChanges } from '../../applyChanges.js';
import { defaultBackgroundKvKey, defaultBackgroundSelectionChanges } from '../background.js';
import { defaultBackgroundFileSlots } from '../fileSlot.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type DefaultBackgroundUpdate = UpdateByType<'updateDefaultBackground'>;

export async function handleUpdateDefaultBackground(
  update: DefaultBackgroundUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  const background = update.background ?? null;
  const key = defaultBackgroundKvKey(update.for_dark_theme);

  await applyIngestionChanges(resources, defaultBackgroundSelectionChanges(update));
  await files.recordFileSlots(defaultBackgroundFileSlots(key, background), 'live_update');
}
