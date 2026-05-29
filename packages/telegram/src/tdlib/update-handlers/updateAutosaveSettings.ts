import { storeAutosaveSettings } from '../../store/autosaveSettings.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireAutosaveSettingsUpdate = TelegramWireUpdateByType<'updateAutosaveSettings'>;

export async function handleUpdateAutosaveSettings(
  update: TelegramWireAutosaveSettingsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const result = await storeAutosaveSettings(database, update);
  events.publishTelegramAutosaveSettingsUpdated(result);
}
