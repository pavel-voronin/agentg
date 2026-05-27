import { storeAutosaveSettings } from '../telegram-store/autosaveSettings.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireAutosaveSettingsUpdate = TelegramWireUpdateByType<'updateAutosaveSettings'>;

export async function handleUpdateAutosaveSettings(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireAutosaveSettingsUpdate
): Promise<void> {
  const result = await storeAutosaveSettings(database, update);
  events.publishTelegramAutosaveSettingsUpdated(result);
}
