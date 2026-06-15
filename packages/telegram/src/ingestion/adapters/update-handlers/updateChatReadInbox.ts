import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatReadInboxChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatReadInboxUpdate = UpdateByType<'updateChatReadInbox'>;

export async function handleUpdateChatReadInbox(
  update: ChatReadInboxUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatReadInboxChanges(update));
}
