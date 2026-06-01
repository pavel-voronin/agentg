import { storeChatPhotoInfo } from '../../store/chatPhotoInfo.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatPhotoUpdate = UpdateByType<'updateChatPhoto'>;

export async function handleUpdateChatPhoto(
  update: ChatPhotoUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  const chatId = String(update.chat_id);
  const photo = update.photo ?? null;

  await storeChatPhotoInfo(database, chatId, photo);
  await files.recordChatPhotoFiles(chatId, photo, 'live_update');
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
