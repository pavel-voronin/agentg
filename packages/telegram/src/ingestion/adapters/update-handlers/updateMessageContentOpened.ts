import { applyIngestionChanges } from '../../applyChanges.js';
import { openedMessageContentChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageContentOpenedUpdate = UpdateByType<'updateMessageContentOpened'>;

export async function handleUpdateMessageContentOpened(
  update: MessageContentOpenedUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, openedMessageContentChanges(update));
}
