import { applyIngestionChanges } from '../../applyChanges.js';
import { messageEditedChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageEditedUpdate = UpdateByType<'updateMessageEdited'>;

export async function handleUpdateMessageEdited(
  update: MessageEditedUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, messageEditedChanges(update));
}
