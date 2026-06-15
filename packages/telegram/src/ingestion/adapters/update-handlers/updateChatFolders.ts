import { applyIngestionChanges } from '../../applyChanges.js';
import { chatFoldersChanges } from '../chatFolder.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ChatFoldersUpdate = UpdateByType<'updateChatFolders'>;

export async function handleUpdateChatFolders(
  update: ChatFoldersUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatFoldersChanges(update));
}
