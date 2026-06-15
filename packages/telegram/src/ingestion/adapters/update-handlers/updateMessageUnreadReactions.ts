import { applyIngestionChanges } from '../../applyChanges.js';
import { messageUnreadReactionsChatChanges } from '../chat.js';
import { messageUnreadReactionsChanges } from '../message.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type MessageUnreadReactionsUpdate = UpdateByType<'updateMessageUnreadReactions'>;

export async function handleUpdateMessageUnreadReactions(
  update: MessageUnreadReactionsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, [
    ...messageUnreadReactionsChanges(update),
    ...messageUnreadReactionsChatChanges(update)
  ]);
}
