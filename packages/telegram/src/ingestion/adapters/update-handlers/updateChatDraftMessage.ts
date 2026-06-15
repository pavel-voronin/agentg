import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatDraftMessageChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatDraftMessageUpdate = UpdateByType<'updateChatDraftMessage'>;

export async function handleUpdateChatDraftMessage(
  update: ChatDraftMessageUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatDraftMessageChanges(update));
}
