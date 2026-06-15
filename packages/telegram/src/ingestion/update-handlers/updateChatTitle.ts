import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatTitleUpdate = UpdateByType<'updateChatTitle'>;

export async function handleUpdateChatTitle(
  update: ChatTitleUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    title: update.title
  });
}
