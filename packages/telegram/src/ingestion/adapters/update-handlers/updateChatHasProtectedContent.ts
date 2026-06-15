import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatHasProtectedContentChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatHasProtectedContentUpdate = UpdateByType<'updateChatHasProtectedContent'>;

export async function handleUpdateChatHasProtectedContent(
  update: ChatHasProtectedContentUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatHasProtectedContentChanges(update));
}
