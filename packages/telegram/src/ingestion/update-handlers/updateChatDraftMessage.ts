import { replaceTelegramChatPositions, upsertTelegramChatFragment } from '../../store/chat.js';
import { tdJsonValue, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatDraftMessageUpdate = UpdateByType<'updateChatDraftMessage'>;

export async function handleUpdateChatDraftMessage(
  update: ChatDraftMessageUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await database.transaction(async (transaction) => {
    await upsertTelegramChatFragment(transaction, {
      draftMessage: tdJsonValue(update.draft_message ?? null) ?? null,
      id: chatId
    });
    await replaceTelegramChatPositions(transaction, chatId, update.positions);
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
