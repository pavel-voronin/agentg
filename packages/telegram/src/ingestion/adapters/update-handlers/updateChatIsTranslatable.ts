import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatIsTranslatableChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatIsTranslatableUpdate = UpdateByType<'updateChatIsTranslatable'>;

export async function handleUpdateChatIsTranslatable(
  update: ChatIsTranslatableUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatIsTranslatableChanges(update));
}
