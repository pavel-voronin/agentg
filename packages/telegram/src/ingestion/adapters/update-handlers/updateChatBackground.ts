import { applyIngestionChanges } from '../../applyChanges.js';
import { chatBackgroundChanges } from '../background.js';
import { chatBackgroundFileSlots } from '../fileSlot.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ChatBackgroundUpdate = UpdateByType<'updateChatBackground'>;

export async function handleUpdateChatBackground(
  update: ChatBackgroundUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  const chatId = String(update.chat_id);
  const background = update.background ?? null;

  await applyIngestionChanges(resources, chatBackgroundChanges(update));
  if (background !== null) {
    await files.recordFileSlots(chatBackgroundFileSlots(chatId, background), 'live_update');
  }
}
