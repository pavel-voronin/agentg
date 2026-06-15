import { replaceTextCompositionStyles } from '../../store/textCompositionStyle.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type TextCompositionStylesUpdate = UpdateByType<'updateTextCompositionStyles'>;

export async function handleUpdateTextCompositionStyles(
  update: TextCompositionStylesUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await replaceTextCompositionStyles(database, update.styles);
}
