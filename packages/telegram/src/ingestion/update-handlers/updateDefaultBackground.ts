import { storeDefaultBackgroundSelection } from '../../store/defaultBackground.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type DefaultBackgroundUpdate = UpdateByType<'updateDefaultBackground'>;

export async function handleUpdateDefaultBackground(
  update: DefaultBackgroundUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  const background = update.background ?? null;
  const selection = await storeDefaultBackgroundSelection(
    database,
    update.for_dark_theme,
    background
  );

  await files.recordDefaultBackgroundFiles(selection.key, background, 'live_update');
  await events.publishTelegramDefaultBackgroundUpdated(selection);
}
