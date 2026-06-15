import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { textCompositionStylesChanges } from '../state.js';
import type { IngestionResources } from '../../resources.js';

type TextCompositionStylesUpdate = UpdateByType<'updateTextCompositionStyles'>;

export async function handleUpdateTextCompositionStyles(
  update: TextCompositionStylesUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, textCompositionStylesChanges(update));
}
