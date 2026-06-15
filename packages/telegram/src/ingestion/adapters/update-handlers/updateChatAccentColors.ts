import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatAccentColorsChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatAccentColorsUpdate = UpdateByType<'updateChatAccentColors'>;

export async function handleUpdateChatAccentColors(
  update: ChatAccentColorsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatAccentColorsChanges(update));
}
