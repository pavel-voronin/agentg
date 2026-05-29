import { storeChatPhotoInfo } from '../../store/chatPhotoInfo.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireChatPhotoUpdate = TelegramWireUpdateByType<'updateChatPhoto'>;

export async function handleUpdateChatPhoto(update: TelegramWireChatPhotoUpdate): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  const chatId = String(update.chat_id);
  const photo = update.photo ?? null;

  await storeChatPhotoInfo(database, chatId, photo);
  await files.recordChatPhotoFiles(chatId, photo, 'live_update');
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
