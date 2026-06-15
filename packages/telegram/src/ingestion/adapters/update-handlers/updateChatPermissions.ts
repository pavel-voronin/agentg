import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatPermissionsChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatPermissionsUpdate = UpdateByType<'updateChatPermissions'>;

export async function handleUpdateChatPermissions(
  update: ChatPermissionsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatPermissionsChanges(update));
}
