import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatActionBarChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatActionBarUpdate = UpdateByType<'updateChatActionBar'>;

export async function handleUpdateChatActionBar(
  update: ChatActionBarUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatActionBarChanges(update));
}
