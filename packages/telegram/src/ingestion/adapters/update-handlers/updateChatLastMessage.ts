import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { chatLastMessageChanges } from '../chat.js';
import { messageFileSlots } from '../fileSlot.js';
import type { IngestionResources } from '../../resources.js';

type ChatLastMessageUpdate = UpdateByType<'updateChatLastMessage'>;

export async function handleUpdateChatLastMessage(
  update: ChatLastMessageUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  const lastMessage = update.last_message ?? null;
  await applyIngestionChanges(resources, chatLastMessageChanges(update));

  if (lastMessage !== null) {
    await files.recordFileSlots(messageFileSlots(lastMessage), 'live_update');
  }
}
