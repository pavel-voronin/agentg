import { applyIngestionChanges } from '../../applyChanges.js';
import { updatedMessageInteractionChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageInteractionInfoUpdate = UpdateByType<'updateMessageInteractionInfo'>;

export async function handleUpdateMessageInteractionInfo(
  update: MessageInteractionInfoUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, updatedMessageInteractionChanges(update));
}
