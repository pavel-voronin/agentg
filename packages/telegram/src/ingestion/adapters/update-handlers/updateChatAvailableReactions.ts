import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatAvailableReactionsChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatAvailableReactionsUpdate = UpdateByType<'updateChatAvailableReactions'>;

export async function handleUpdateChatAvailableReactions(
  update: ChatAvailableReactionsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatAvailableReactionsChanges(update));
}
