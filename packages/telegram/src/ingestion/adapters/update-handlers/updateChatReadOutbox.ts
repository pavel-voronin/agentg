import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatReadOutboxChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatReadOutboxUpdate = UpdateByType<'updateChatReadOutbox'>;

export async function handleUpdateChatReadOutbox(
  update: ChatReadOutboxUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatReadOutboxChanges(update));
}
