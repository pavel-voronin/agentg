import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatViewAsTopicsUpdate = TelegramWireUpdateByType<'updateChatViewAsTopics'>;

export async function handleUpdateChatViewAsTopics(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatViewAsTopicsUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    viewAsTopics: update.view_as_topics
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
