import { applyIngestionChanges } from '../../applyChanges.js';
import { chatPhotoInfoChanges } from '../chatPhotoInfo.js';
import { chatPhotoFileSlots } from '../fileSlot.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ChatPhotoUpdate = UpdateByType<'updateChatPhoto'>;

export async function handleUpdateChatPhoto(
  update: ChatPhotoUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  const chatId = String(update.chat_id);
  const photo = update.photo ?? null;

  await applyIngestionChanges(resources, chatPhotoInfoChanges(update));
  await files.recordFileSlots(chatPhotoFileSlots(chatId, photo), 'live_update');
}
