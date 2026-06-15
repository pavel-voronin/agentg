import { applyIngestionChanges } from '../../applyChanges.js';
import { messageFileSlots } from '../fileSlot.js';
import { messageSendSucceededChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageSendSucceededUpdate = UpdateByType<'updateMessageSendSucceeded'>;

export async function handleUpdateMessageSendSucceeded(
  update: MessageSendSucceededUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(resources, messageSendSucceededChanges(update));
  await files.recordFileSlots(messageFileSlots(update.message), 'live_update');
}
