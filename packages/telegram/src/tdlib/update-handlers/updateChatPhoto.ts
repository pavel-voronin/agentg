import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { storeChatPhotoInfo } from '../../store/chatPhotoInfo.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatPhotoUpdate = TelegramWireUpdateByType<'updateChatPhoto'>;

export async function handleUpdateChatPhoto(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireChatPhotoUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const photo = update.photo ?? null;

  await storeChatPhotoInfo(database, chatId, photo);
  await files.recordChatPhotoFiles(chatId, photo, 'live_update');
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
