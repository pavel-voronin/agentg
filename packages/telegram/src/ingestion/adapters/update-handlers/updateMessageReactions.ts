import { applyIngestionChanges } from '../../applyChanges.js';
import { replacedMessageReactionSummariesChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageReactionsUpdate = UpdateByType<'updateMessageReactions'>;

export async function handleUpdateMessageReactions(
  update: MessageReactionsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, replacedMessageReactionSummariesChanges(update));
}
