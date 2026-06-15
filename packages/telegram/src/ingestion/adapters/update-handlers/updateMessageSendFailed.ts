import { applyIngestionChanges } from '../../applyChanges.js';
import { messageFileSlots } from '../fileSlot.js';
import { messageSendFailedChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageSendFailedUpdate = UpdateByType<'updateMessageSendFailed'>;

export async function handleUpdateMessageSendFailed(
  update: MessageSendFailedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(resources, messageSendFailedChanges(update));
  await files.recordFileSlots(messageFileSlots(update.message), 'live_update');
}
