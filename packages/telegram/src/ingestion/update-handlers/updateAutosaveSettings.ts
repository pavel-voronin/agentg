import { storeAutosaveSettings } from '../../store/autosaveSettings.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type AutosaveSettingsUpdate = UpdateByType<'updateAutosaveSettings'>;

export async function handleUpdateAutosaveSettings(
  update: AutosaveSettingsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeAutosaveSettings(database, update);
}
