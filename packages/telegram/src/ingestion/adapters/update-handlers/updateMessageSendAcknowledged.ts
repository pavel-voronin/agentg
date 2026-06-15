import { applyIngestionChanges } from '../../applyChanges.js';
import { messageSendAcknowledgedChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageSendAcknowledgedUpdate = UpdateByType<'updateMessageSendAcknowledged'>;

export async function handleUpdateMessageSendAcknowledged(
  update: MessageSendAcknowledgedUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, messageSendAcknowledgedChanges(update));
}
