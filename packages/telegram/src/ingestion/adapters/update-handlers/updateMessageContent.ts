import { applyIngestionChanges } from '../../applyChanges.js';
import { messageContentFileSlots } from '../fileSlot.js';
import { updatedMessageContentChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageContentUpdate = UpdateByType<'updateMessageContent'>;

export async function handleUpdateMessageContent(
  update: MessageContentUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(resources, updatedMessageContentChanges(update));
  await files.recordFileSlots(messageContentFileSlots(update), 'live_update');
}
