import { upsertTelegramChatFragment } from '../../store/chat.js';
import { tdJsonValue, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatBusinessBotManageBarUpdate = UpdateByType<'updateChatBusinessBotManageBar'>;

export async function handleUpdateChatBusinessBotManageBar(
  update: ChatBusinessBotManageBarUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    businessBotManageBar: tdJsonValue(update.business_bot_manage_bar ?? null) ?? null,
    id: chatId
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
