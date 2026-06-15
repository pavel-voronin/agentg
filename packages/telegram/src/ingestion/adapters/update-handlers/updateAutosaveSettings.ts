import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { autosaveSettingsChanges } from '../settings.js';
import type { IngestionResources } from '../../resources.js';

type AutosaveSettingsUpdate = UpdateByType<'updateAutosaveSettings'>;

export async function handleUpdateAutosaveSettings(
  update: AutosaveSettingsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, autosaveSettingsChanges(update));
}
