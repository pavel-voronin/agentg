import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatTitleChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatTitleUpdate = UpdateByType<'updateChatTitle'>;

export async function handleUpdateChatTitle(
  update: ChatTitleUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatTitleChanges(update));
}
