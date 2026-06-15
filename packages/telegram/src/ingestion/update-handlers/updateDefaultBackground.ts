import { storeDefaultBackgroundSelection } from '../../store/defaultBackground.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type DefaultBackgroundUpdate = UpdateByType<'updateDefaultBackground'>;

export async function handleUpdateDefaultBackground(
  update: DefaultBackgroundUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  const background = update.background ?? null;
  const selection = await storeDefaultBackgroundSelection(
    database,
    update.for_dark_theme,
    background
  );

  await files.recordDefaultBackgroundFiles(selection.key, background, 'live_update');
}
