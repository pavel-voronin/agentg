import { upsertTelegramChatFragment } from '../../store/chat.js';
import { tdJsonObject, type UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatAvailableReactionsUpdate = UpdateByType<'updateChatAvailableReactions'>;

export async function handleUpdateChatAvailableReactions(
  update: ChatAvailableReactionsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    availableReactions: tdJsonObject(update.available_reactions),
    id: chatId
  });
}
