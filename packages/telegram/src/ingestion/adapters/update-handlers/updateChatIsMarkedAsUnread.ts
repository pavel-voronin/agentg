import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatIsMarkedAsUnreadChanges } from '../chat.js';
import type { IngestionResources } from '../../resources.js';

type ChatIsMarkedAsUnreadUpdate = UpdateByType<'updateChatIsMarkedAsUnread'>;

export async function handleUpdateChatIsMarkedAsUnread(
  update: ChatIsMarkedAsUnreadUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, chatIsMarkedAsUnreadChanges(update));
}
