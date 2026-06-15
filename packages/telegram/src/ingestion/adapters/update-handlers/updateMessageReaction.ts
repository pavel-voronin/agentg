import { applyIngestionChanges } from '../../applyChanges.js';
import { updatedMessageReactionChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageReactionUpdate = UpdateByType<'updateMessageReaction'>;

export async function handleUpdateMessageReaction(
  update: MessageReactionUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(
    resources,
    updatedMessageReactionChanges(update, {
      currentAccountSenderKey: resources.account.senderKey()
    })
  );
}
