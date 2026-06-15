import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { savedChatChanges } from '../chat.js';
import { chatFileSlots, messageFileSlots } from '../fileSlot.js';
import type { IngestionResources } from '../../resources.js';

type NewChatUpdate = UpdateByType<'updateNewChat'>;

export async function handleUpdateNewChat(
  { chat }: NewChatUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  const lastMessage = chat.last_message ?? null;
  await applyIngestionChanges(resources, savedChatChanges(chat));

  await files.recordFileSlots(chatFileSlots(chat), 'live_update');
  if (lastMessage !== null) {
    await files.recordFileSlots(messageFileSlots(lastMessage), 'live_update');
  }
}
