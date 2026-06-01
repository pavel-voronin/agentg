import { storeAutosaveSettings } from '../../store/autosaveSettings.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type AutosaveSettingsUpdate = UpdateByType<'updateAutosaveSettings'>;

export async function handleUpdateAutosaveSettings(
  update: AutosaveSettingsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const result = await storeAutosaveSettings(database, update);
  await events.publishTelegramAutosaveSettingsUpdated(result);
}
