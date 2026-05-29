import { storeDefaultBackgroundSelection } from '../../store/defaultBackground.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireDefaultBackgroundUpdate = TelegramWireUpdateByType<'updateDefaultBackground'>;

export async function handleUpdateDefaultBackground(
  update: TelegramWireDefaultBackgroundUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  const background = update.background ?? null;
  const selection = await storeDefaultBackgroundSelection(
    database,
    update.for_dark_theme,
    background
  );

  await files.recordDefaultBackgroundFiles(selection.key, background, 'live_update');
  events.publishTelegramDefaultBackgroundUpdated(selection);
}
