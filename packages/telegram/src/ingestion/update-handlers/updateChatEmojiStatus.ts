import { upsertTelegramChatFragment } from '../../store/chat.js';
import { tdJsonValue, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatEmojiStatusUpdate = UpdateByType<'updateChatEmojiStatus'>;

export async function handleUpdateChatEmojiStatus(
  update: ChatEmojiStatusUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    emojiStatus: tdJsonValue(update.emoji_status ?? null) ?? null,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
