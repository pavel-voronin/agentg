import { replaceAttachmentMenuBots } from '../../store/attachmentMenuBot.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type AttachmentMenuBotsUpdate = UpdateByType<'updateAttachmentMenuBots'>;

export async function handleUpdateAttachmentMenuBots(
  { bots }: AttachmentMenuBotsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await replaceAttachmentMenuBots(database, bots);
}
