import { applyIngestionChanges } from '../../applyChanges.js';
import { messageFactCheckChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageFactCheckUpdate = UpdateByType<'updateMessageFactCheck'>;

export async function handleUpdateMessageFactCheck(
  update: MessageFactCheckUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, messageFactCheckChanges(update));
}
