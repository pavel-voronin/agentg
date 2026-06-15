import { applyIngestionChanges } from '../../applyChanges.js';
import { attachmentMenuBotsChanges } from '../attachmentMenuBot.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type AttachmentMenuBotsUpdate = UpdateByType<'updateAttachmentMenuBots'>;

export async function handleUpdateAttachmentMenuBots(
  update: AttachmentMenuBotsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, attachmentMenuBotsChanges(update));
}
